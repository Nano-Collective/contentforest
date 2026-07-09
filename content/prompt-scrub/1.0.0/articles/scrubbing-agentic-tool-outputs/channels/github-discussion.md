---
product: prompt-scrub
version: "1.0.0"
channel: github-discussion
title: "Scrubbing tool output inside an agentic loop"
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 14636
---

# Scrubbing tool output inside an agentic loop

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The headline post for `prompt-scrub v1.0.0` introduced the package and its threat model. A sibling post walked through the secret detector's three-layer shape. Another walked through the rule-pack contract. This post is about the part of the threat model that does the most work in practice and gets the least attention in the docs: tool output in an agentic coding loop.

When you put a model in a `read → act → read → act` loop, every tool result (`ls`, `git log`, `cat file`, `grep`, file reads from any MCP server) is a chunk of host-machine text that goes back into the next LLM turn. If you are routing those turns through a cloud provider, the host identifier exposure is on the same path as your prompt. This post is a how-to for wrapping each of those results in a scrub pass before it reaches the next turn, including the exact message-array shape the library expects, the gaps the v1 detector set leaves open, and the inspect-first workflow I use to verify what is and is not caught.

## The message-array shape, and why it matters

`scrub()` accepts either a plain string or an array of OpenAI-shaped `{ role, content }` messages. The same call handles both. The shape you want for a multi-turn conversation that includes tool results is:

```typescript
import { scrub, rehydrate } from '@nanocollective/prompt-scrub';

const messages: { role: string; content: string }[] = [
  { role: 'system',    content: 'You are editing /Users/me/work/proj. Reply with diffs only.' },
  { role: 'user',      content: 'Find the bug in the auth flow.' },
  { role: 'assistant', content: 'Reading the auth module now.' },
  { role: 'tool',      content: 'src/auth.ts:\nconst SECRET = "sk-12345";\n...' },
  { role: 'assistant', content: 'The bug is on line 12.' },
];

const { scrubbedContent, sessionId } = scrub({ content: messages });
```

What comes out has the same shape and the same length per message. Structure is preserved: the `role` strings are untouched, only the `content` strings get walked. From the reading code in `src/core/scrub.ts`:

```ts
// Message[]: scrub each message's content independently, preserve structure
scrubbedContent = content.map((msg) => ({
  ...msg,
  content: scrubString(msg.content, detectors, session),
}));
```

That is the contract. The same `{ role, content }` object per message, content scrubbed independently, role strings passed through. You can build the array the same way the OpenAI/Anthropic/Gemini chat completion APIs want it, hand it to `scrub()` as the last step before the network call, and the messages leaving your machine match a shape the provider already understands.

The session id from this call is what you pass back through `rehydrate()` when the model responds. Rehydration walks the response text and swaps each placeholder back to its original value, so when the model says "the bug is at `Secret_1`," the user sees "the bug is at `sk-12345`." The shape is symmetric in the other direction too: `rehydrate()` accepts the same `{ role, content }` array and walks each content string against the session map.

## Wrapping each tool result: a thin wrapper

The mechanical part of an "agentic loop scrubber" is small. A wrapper around whatever tool-calling driver you use (the MCP client, the OpenAI tool-loop library, your own shell) that scrubs the result of every tool call before the message is appended to the conversation log:

```typescript
async function safeToolCall(
  name: string,
  args: unknown,
  rawInvoke: (name: string, args: unknown) => Promise<string>,
  sessionId?: string,
) {
  const raw = await rawInvoke(name, args);
  const { scrubbedContent, sessionId: newSessionId } = scrub({
    content: [{ role: 'tool', content: raw }],
    sessionId,
  });
  return { content: scrubbedContent[0].content, sessionId: newSessionId };
}
```

Two details that matter:

1. The tool message that comes out carries the **scrubbed** content, not the raw output. The cloud provider only ever sees the redacted form. The raw `string` returned by `rawInvoke` never leaves the wrapper.
2. The session id is threaded through the loop. If the assistant asked three tool questions in a row, all three tool results get scrubbed against the same session map, so a path the user mentioned in the first prompt and that one of the tool outputs also contains gets the same `Path_1` placeholder. Rehydration stays deterministic.

For rehydration on the response side, the symmetric wrapper walks the assistant's text and swaps placeholders back. Same session id, same direction:

```typescript
async function safeRehydrate(
  text: string,
  sessionId: string,
): Promise<{ content: string; warnings: string[] }> {
  const { content, warnings } = rehydrate({ content: text, sessionId });
  return { content: content as string, warnings: warnings ?? [] };
}
```

The `warnings` array is the part people miss. If the model invents a placeholder (writes `Email_3` when only `Email_1` and `Email_2` exist in the session), `rehydrate()` passes it through unchanged and surfaces it as a warning. In an agentic loop that matters: a model that hallucinates a placeholder mid-tool-session and you do not flag it ends up sending the literal string "Email_3" to the user. Surface the warnings and reject the response, or at minimum log them.

## Where the v1 detector set leaves gaps

The headline covers what the eight v1 detectors catch. The honest list of what they do not catch inside tool output is what a cautious operator needs to know.

The path detector matches Unix-style and Windows-style absolute paths. It does not match relative paths like `./auth.ts` or `../shared/util.ts`, which are exactly the paths an `ls`-style tool result will spit back at you. In a project-relative result, only paths that contain a recognised shape with a `~` or drive letter get caught. If your shell tool returns relative paths, the `Path_n` placeholder count will be lower than you expect.

The email detector catches the canonical `[a-z]+@[a-z]+\.[a-z]{2,}` shape. It does not catch addresses with quoted local parts (`"alice smith"@example.com`), unicode local parts, or addresses that lack a TLD. A `git log` output often contains `<dev@dev.null>` or `<dev@localhost>` shapes that no TLD-aware regex will fire on. If your team uses internal mailing conventions, the email count will be lower than you expect.

The URL detector catches `http://`, `https://`, and a few other schemes. A tool result from `cat /etc/hosts` or `cat ~/.ssh/config` contains hostnames with no scheme at all, and these are often more identifying than the URLs around them (a hostname in `/etc/hosts` maps back to a specific machine). The v1 detector set does not have a standalone hostname detector. Internal-use hostnames leak through unscrubbed unless they happen to be wrapped in a URL.

The secret detector's three layers catch API keys, tokens, and known vendor prefixes. They do not catch private key material dumped from `~/.ssh/id_rsa` (PEM-armoured blocks), SSH `known_hosts` lines (which include hostname, key type, and key fingerprint in a single line), or `cat .env` output that does not use a recognised variable name convention. A `cat` of an SSH config can leak a username, a hostname, an identity file path, and a ProxyCommand shell snippet in a handful of lines, and the placeholders will be sparse.

The phone, postal address, name, and code-tell detectors behave similarly: each one has a specific shape they catch, and tool output that does not look like the shape goes through unchanged.

This is not a complaint. The v1 detector set was tuned for the accidental case ("I pasted an email into a prompt by mistake"). The agentic case was always going to be harder, and the docs say so explicitly: the threat model states that "coverage is limited to the configured detectors; the host of leaks a clever tool call could produce is not enumerated exhaustively in v1." The right move is to know what the gap looks like, then decide which gap matters for the agentic loop you actually run.

The two practical mitigations for v1 are:

- **Add `codeTellTerms`** for project codenames and internal hostnames. The `code-tell` detector is opt-in for a reason: it requires an enumerated list. For an agentic loop, that list is usually the names of your internal services, internal host names, and known project codenames. Treat it as a deliberately curated allowlist, not as a generic privacy net.
- **Add a custom detector** for the categories you actually need. The `customDetectors` option in `ScrubOptions` accepts any object implementing the standard `Detector` interface, so a 20-line regex with a short `detect()` method slots into the same collision and rehydration pipeline as the built-ins. A regular-expression hostname detector against `cat /etc/hosts`-shaped output is a small amount of code.

## The inspect-first workflow

The most useful command in the v1 CLI is `inspect`. It runs the full detector pipeline against the input, produces a structured diff of what would be redacted and what would survive, prints a SHA-256 of the would-be scrubbed text, and does not write a session file. You can run it on anything that goes into a tool result before you wire it into the loop:

```bash
# A realistic tool output worth checking before sending it to a model
$ cat /etc/hosts
127.0.0.1       localhost
192.168.4.21    staging-web-01.internal
192.168.4.22    prod-db-03.internal
10.0.0.5        vault.internal

$ cat /etc/hosts | prompt-scrub inspect
```

In my runs, the v1 detector set catches zero of the four lines above. The hostnames (`staging-web-01.internal`, etc.) pass through, the IPs pass through, and no placeholder is generated. The output of `inspect` confirms that with a single line: `No sensitive entities detected.` That confirmation is exactly what the workflow is for. If you see "No sensitive entities detected" on output you expected to be redacted, you have a gap, and you can fix it (custom detector, code-tell term, disabled detector you should have enabled) before the message reaches the cloud provider.

The workflow I run before turning a new agentic loop on:

1. Take one tool's worth of representative output. A directory listing, a `git log --oneline -20`, a `cat` of a real config file.
2. Pipe it through `prompt-scrub inspect`.
3. Read the diff. For each line, ask: "is this OK to leave in front of a cloud LLM?" If the answer is yes, the detector is correct for this content. If the answer is no, the gap is real and the fix lives in either configuration (turn on the relevant detector, add a code-tell term) or in code (add a custom detector).
4. Repeat per tool. Each tool has a different output shape. Each shape has its own gap list.

The hash output from `inspect` is also useful in this workflow: if you re-run the same input through the scrubber later and the hash matches, the scrubbed output is byte-stable (which is the property the prompt-cache prefix depends on). If the hash drifts, your `inspect` and `scrub` runs are not seeing the same detector configuration, and you should stop until they do.

## A concrete end-to-end shape

Putting the pieces together, the wrapper around a tool-calling driver looks like this in TypeScript:

```typescript
import { scrub, rehydrate, type Message } from '@nanocollective/prompt-scrub';

type Tool = (name: string, args: unknown) => Promise<string>;

async function scrubbedToolCall(
  tool: Tool,
  name: string,
  args: unknown,
  sessionId?: string,
) {
  const raw = await tool(name, args);
  const { scrubbedContent, sessionId: nextSessionId } = scrub({
    content: [{ role: 'tool', content: raw }],
    sessionId,
  });
  return {
    toolMessage: scrubbedContent[0] as Message,
    sessionId: nextSessionId,
  };
}

function rehydratedAssistant(text: string, sessionId: string) {
  const { content, warnings } = rehydrate({ content: text, sessionId });
  return { text: content as string, warnings: warnings ?? [] };
}
```

What this gives you, per turn:

- Tool output enters the wrapper as a raw string.
- The wrapper scrubs it through the same `{ role: 'tool', content: ... }` shape that the model is going to see, against whatever session id is current.
- The model's response goes through `rehydrate()` with the same session id, so the model can refer to "the secret you mentioned earlier" and the user sees the original value.
- `warnings` from `rehydrate()` surface hallucinated placeholders. They should be logged and used to reject the response, or at minimum to add to a watch list.

The thing to keep in mind is that v1 is a partial defence, and the threat model is explicit about that. A wrapper like this one reduces host identifier exposure on every tool result, to the extent the configured detectors recognise the shapes the tool actually produces. It does not eliminate it. The gaps in the detector set are documented, and the inspect-first workflow is the way to find out what they cost you before the model does.

## What I am still working out

A few things I would like to hear from people who are running this in the wild:

- **Which gap bit you.** If you have an agentic loop where a specific kind of tool result (`.env` dumps, SSH config, `cat /etc/hosts`, MCP server responses) is the source of an audit problem, that is exactly the content a custom detector should be catching, and we would like to know what shape it has.
- **Custom detector ergonomics.** The `customDetectors` option takes a `Detector`. The same shape works in the rule-pack model described in the sibling post. Whether a one-off custom detector belongs inline in the wrapper or in a dedicated rule pack is a judgement call we have not yet seen enough of to make a recommendation.
- **Session lifecycle.** A session id is the right scope for a single conversation, including its tool calls and the assistant's rehydrated response. A loop that opens new sessions per tool call loses the determinism that prompt-cache prefixes depend on, and a loop that opens one session for a long-lived loop accumulates placeholders over time. Both shapes are valid; the right answer probably depends on how long the loop runs and how often you rehydrate.

If you have an agentic loop wired this way, the source for the pieces above is at the repo below. Issues, PRs, and detector proposals are all welcome.

Source, tests, and the full `scrub()` and `rehydrate()` pipeline: https://github.com/Nano-Collective/prompt-scrubber
