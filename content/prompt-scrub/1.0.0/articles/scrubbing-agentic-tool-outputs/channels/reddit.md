---
product: prompt-scrub
version: "1.0.0"
channel: reddit
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 4365
---

A thing I learned writing the agentic-loop wrapper for `prompt-scrub v1.0.0`: scrubbing tool output in a `read -> act -> read -> act` loop is way smaller in code than the privacy benefit suggests, but the gap list on the detector side is longer than most people assume.

The mechanical piece: the same `{ role: 'tool', content: ... }` shape your model expects is the shape `scrub()` walks. Wrap each tool invocation: call the tool, scrub the raw string as a tool-role message against the current session id, hand the scrubbed result to the model, then rehydrate the model's response back through the same session. Two function calls per turn, both stateless wrappers around the existing `scrub()` and `rehydrate()` entry points. You can see the contract in `src/core/scrub.ts`:

```ts
scrubbedContent = content.map((msg) => ({
  ...msg,
  content: scrubString(msg.content, detectors, session),
}));
```

That's it. `role` strings untouched, `content` walked. Rehydration is symmetric on the response side.

The bit I want to flag for anyone wiring this into a real loop: the v1 detector set is honest about its limits, and tool output is exactly the kind of content where the limits show up. The path detector handles absolute Unix and Windows paths; relative paths in `ls`-style output go through unchanged. The email detector needs a TLD-shaped local part; `<dev@localhost>` lines from a `git log` pass through unchanged. The URL detector needs a scheme; hostnames in `cat /etc/hosts` (the most identifying thing a `cat` can produce, since they map back to specific machines) are not caught by anything in the box. The secret detector's three layers catch API keys and tokens well but skip PEM-armoured private keys from `~/.ssh/id_rsa`, skip `~/.ssh/known_hosts` lines, and skip `cat .env` payloads whose variable names don't match the conventional allowlist.

The threat model doc says so explicitly: "coverage is limited to the configured detectors; the host of leaks a clever tool call could produce is not enumerated exhaustively in v1." That sentence is the whole reason I treat `inspect` as the pre-flight step rather than a curiosity. Before turning any loop on, take representative output from each tool the loop calls. Pipe it through `prompt-scrub inspect`. Read the diff it prints. The format is:

```
Detected entities:
  [Email]    alice@example.com              -> Email_1  (chars X-Y)

No session written.
Hash: <sha256>
```

The hash is the part people sleep on. If you re-run the same input later and the SHA-256 doesn't match, your configuration drifted between the inspect pass and the real run, which means your prompt-cache prefixes aren't byte-stable and your privacy posture isn't what you tested. `inspect` does not write a session file, so it's safe to run repeatedly on real content.

For the gaps the v1 detector set leaves, the two practical fix vectors are `codeTellTerms` (for a curated allowlist of project codenames and internal hostnames) and `customDetectors` (for anything more specific). The custom-detector shape is the same one the rule-pack contract uses, and the long-form post on rule packs goes deep on it. A regular-expression hostname detector that catches internal `*.internal` patterns is maybe twenty lines of TypeScript and slots into the collision and rehydration pipeline as if it were built in.

The thing I'd most like feedback on:

1. Which gap bit you in practice. If you're running an agentic loop on a cloud LLM, which `.env` or SSH config or `/etc/hosts`-shaped output ended up being the source of an audit problem, and what shape would a detector need to have to catch it?
2. Custom detector ergonomics. Is a one-off custom detector meant to live inline in the wrapper, or in a dedicated rule pack? Both shapes work today, we just have not seen enough real-world examples to recommend one over the other.
3. Session lifecycle. One session per loop is the simple answer. Per-tool-call sessions lose prompt-cache prefix determinism. One long-lived session accumulates placeholders over time. If you have run a real loop, what worked?

The long-form post walks through the message-array shape, the gap list, the inspect-first workflow, and the end-to-end wrapper code. It's at the repo:

Source, examples, and the full `scrub()` and `rehydrate()` pipeline: https://github.com/Nano-Collective/prompt-scrubber
