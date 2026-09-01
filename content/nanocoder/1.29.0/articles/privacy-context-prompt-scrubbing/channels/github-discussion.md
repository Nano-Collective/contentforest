---
product: nanocoder
version: "1.29.0"
channel: github-discussion
title: "PrivacyContext: scrubbing prompts without breaking the conversation"
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 17534
distributed_at: "2026-09-01T13:58:00.260Z"
---

Nanocoder v1.29.0 ships a feature we have wanted for a while: when you point Nanocoder at a cloud model on a private codebase, the model only ever sees placeholders for the identifying bits of your prompt. Locally, the placeholders resolve back to the values the agent actually needs to keep working. This post walks through how the scrub pipeline is wired into the chat request, what is and is not a content-layer problem, and the two design decisions that took the most iteration: which detectors to run in the agent context, and where the placeholder map lives.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The full project lives at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## What ships in v1.29.0

The privacy-aware scrubbing in this release is the integration of the standalone [`@nanocollective/prompt-scrub`](https://github.com/Nano-Collective/nanocoder) package (`^1.0.1`) into the chat request path. Three things are user-facing:

- A new `PrivacyContext` (`source/context/privacy-context.tsx`) that exposes the enabled flag and a ref to the placeholder session map.
- A `/privacy` command, with an `inspect <text>` subcommand that runs the same scrub pipeline against user-supplied text and prints the placeholders that would have been sent.
- A per-turn chat-queue notification on every model call that scrubbed at least one new identifier, so you know when the feature is doing something rather than it happening silently.

Behind the scenes, scrubbing runs at exactly one point in the chat pipeline: just before the AI SDK builds the request. There is no second hop or background rewriter. The reasoning, the assistant text, and the tool-call arguments are rehydrated after the stream completes, before they reach the conversation history. That is the entire shape of the feature.

## The pipeline, in five steps

A single chat turn goes through this:

1. Read the messages array from the conversation loop.
2. Pull out the system prompt (`role: system`); the rest of the array becomes the non-system messages.
3. If scrubbing is enabled, run `scrub()` on the system prompt and each non-tool message, threading the same `privacySessionMapRef.current` through. Emit a notification if the session map grew.
4. Hand the scrubbed messages to the AI SDK, which builds the request exactly as it would have without scrubbing.
5. When the response comes back, run `rehydrate()` over the assistant text, the assistant reasoning, and each tool-call `arguments` JSON string. The model sees placeholders while generating; the agent sees real values while executing.

The implementation lives across three places. The context object is `source/context/privacy-context.tsx`, which is just a typed React context with `{ privacyEnabled, privacySessionMapRef }`. The ref is created in `useAppState` (`source/hooks/useAppState.tsx`) and is the same instance for the lifetime of the app:

```ts
const privacySessionMapRef = useRef<Record<string, string>>({});
```

The scrub and rehydrate calls live in `source/ai-sdk-client/chat/chat-handler.ts`, around the AI SDK request boundary. There is no other integration point: the loop, the tool executor, and the UI all see the same shape they would see without scrubbing, because the placeholders are resolved in-place before they leave that function.

## What the package gives us

`@nanocollective/prompt-scrub` is a small library with a single pipeline:

- A pluggable detector system (each detector is a class or function that takes a string and returns an array of `Finding` objects with `category`, `span`, `value`, and a `placeholderPrefix`).
- A `scrub()` function that runs the detectors in priority order, resolves collisions, applies stable placeholders across a session, and returns the scrubbed text plus the updated session map.
- A `rehydrate()` function that swaps the placeholders back to their originals using the same session map.
- A built-in priority chain. `SecretDetector` wins, then `EmailDetector`, `UrlDetector`, `PathDetector`, `PhoneDetector`, `AddressDetector`. The `NameDetector` and `CodeTellDetector` are opt-in because their false-positive rates are meaningfully higher.

The `Finding` shape is the same the package's rule-pack authors implement against, which is what lets an organisation publish a private detector set as an npm package, declare it in `package.json` under `prompt-scrub.rulePacks`, and have it loaded alongside the built-ins. We are not relying on any of that integration in Nanocoder yet; v1.29.0 uses only the built-ins.

## The first design call: which detectors to run

The instant we wired `scrub()` into the chat handler, two detectors became obviously wrong in the agent context: `PathDetector` and `UrlDetector`.

Consider what a normal prompt looks like once an agent is running. You ask the agent to fix a bug, and a typical conversation already contains:

- The path of the repo you launched Nanocoder in.
- The path to the file you asked it to edit.
- URLs from `git log`, `npm install` output, or `package.json` listings.
- Maybe an AWS endpoint or a webhook URL the agent needs to keep working with.

If we run `PathDetector` and `UrlDetector` over that, the cloud provider sees `Path_1`, `Path_2`, `Path_3`, `Url_1` everywhere the model actually needs to see a real path or URL. The conversation starts to break: the agent refers to `Path_1` in a tool call, but the tool call needs the real value. The user fixes the bug because the model is now reasoning about a known-bad string of placeholders.

That is exactly the failure mode the package's threat model warns about when it says "Semantic leakage: a question that is inherently identifying (your private codebase, a niche bug only you have, a number only your accountant knows) cannot be made anonymous by stripping identifiers." For an agent on a project, the paths and URLs are part of the identifying information by definition.

The fix in `chat-handler.ts` is to pass `options: { disabledDetectors: ['PathDetector', 'UrlDetector'] }` on every scrub call:

```ts
finalSystemContent = scrub({
  content: systemContent,
  sessionMap: privacySessionMapRef.current,
  options: { disabledDetectors: ['PathDetector', 'UrlDetector'] },
}).scrubbedContent as string;
```

Cloud providers still see that you pasted an absolute path, but they do not see emails, phone numbers, API keys, or postal addresses in your prompt. That is the trade the agent context allows, and we made it explicit. The detectors are off at the call site, not globally configured; users who want to extend or constrain the set can do so without us deciding for them.

The other five built-ins (`SecretDetector`, `EmailDetector`, `PhoneDetector`, `AddressDetector`, plus the opt-in `NameDetector` and `CodeTellDetector`) remain enabled. `SecretDetector` is the one we are least willing to compromise on. Missing a credential is materially worse than missing a name, and the detector is tuned accordingly.

## The second design call: where the session map lives

The package's docs describe a session manager that writes the placeholder map to disk in the user's config directory, so an `Email_1` from yesterday's session is the same `Email_1` in today's session. That is the right design for a stand-alone CLI that you run between projects.

It is the wrong design for Nanocoder for two reasons. First, the placeholder map is sensitive data in its own right: it carries the original email, phone, secret, and address values the user did not want sent to the cloud. Putting that map on disk in `~/Library/Application Support/prompt-scrub/sessions/<id>.json` would make the disk a richer privacy target than the prompt was. Second, an agent session is one app process, and an app process already has a place to keep volatile state: a `useRef`. The session map lives there:

```ts
// source/hooks/useAppState.tsx
const privacySessionMapRef = useRef<Record<string, string>>({});
```

The ref is threaded through the chat handler the same way any other piece of app state is, by accepting it as a parameter and reading it at the right point. When the app exits, the ref is gone, which is fine: the user is not asking for placeholder stability across app restarts, and the threat model explicitly says a compromised machine is out of scope anyway. We have not invented encryption at rest; we have just not written the secret values to disk in the first place.

The other reason this matters is `JSON.stringify` round-tripping on tool-call arguments. The model emits `{"path": "/Users/me/project/src/app.tsx"}`. If we had disabled `PathDetector`, that string is exactly what we want to rehydrate. If we had enabled it, we would have to scrub the argument as plain text, get back `{"path": "Path_3"}`, and then rehydrate `Path_3` back to the real value. The current `chat-handler.ts` rehydrates by JSON-round-tripping the entire arguments object, which keeps object shape intact and avoids silent breaks on edge cases:

```ts
finalToolCalls = finalToolCalls.map(tc => {
  try {
    const argsStr = JSON.stringify(tc.function.arguments);
    const result = rehydrate({
      content: argsStr,
      sessionMap: privacySessionMapRef.current,
    });
    return {
      ...tc,
      function: {
        ...tc.function,
        arguments: JSON.parse(result.content as string),
      },
    };
  } catch (e) {
    logger.error('Failed to rehydrate tool call', { toolName: tc.function.name, error: e });
    return tc;
  }
});
```

The try/catch is a deliberate walk-back: if a placeholder has been removed from the map (because the user cleared the session, or because a session map rotation happened mid-stream), rehydration is partially undefined and we fall back to the scrubbed tool call rather than crash the conversation. The agent then sees the placeholder and can recover on the next turn, which is consistent with the threat model: partial coverage is fine, blast radius has to be small.

## Stable placeholders within a session

Stable placeholders are the part that makes the feature feel less like a one-off scrub and more like a session-wide substitution. The package reuses `Email_1` for the same email across the whole conversation, instead of inventing `Email_5` on the next turn. Two reasons:

- It stops the cloud provider from correlating identities across turns. Every reference to "the same customer email" looks like a reference to `Email_1`, regardless of which turn it appears in.
- It stops the local agent from re-deriving the same identity on every turn. The model is told `Email_1` resolves to the same value throughout the session, so its memory of who "the customer" is does not get fragmented across six renames.

Within a single session the mapping is stable. Across sessions it is not. The cloud provider cannot build a long-term profile by joining `Email_1` from yesterday's map to `Email_1` from today's. The threat model calls this out explicitly: stable session mappings address identifier-level correlation within a session; they do not address stylistic fingerprinting, semantic leakage, or cross-session profiling.

## The notification: per-turn deltas, not running totals

The wired-up `onPrivacyEvent` callback reports the per-turn delta: the number of new identifiers added to the session map on this turn, not a running total. The notification is a chat-queue message that reads `Privacy active: scrubbed N new identifier(s)`. Three properties of this:

- It fires only when there is a delta. If a turn finds nothing new, nothing is printed. That keeps the chat readable across long sessions where the same email appears a hundred times.
- It is a soft signal, not a hard gate. There is no "are you sure?" prompt. The detection is local, deterministic, and idempotent; if it ran, the chat moves on.
- It is per turn, not per session. A user who wants to audit the full session opens `/privacy inspect` on representative text.

The notification can be turned off implicitly by disabling scrubbing entirely; we did not add a per-notification mute because the entire feature is opt-in, via `enablePromptScrubbing` in preferences (`source/config/preferences.ts`).

## The `/privacy inspect` command

`/privacy` is registered in `source/commands/lazy-registry.ts` and is a stateless inspector. It calls the same `scrub()` from the chat handler, with the same disabled detectors, but with an empty `sessionMap: {}`:

```ts
const result = scrub({
  content: text,
  sessionMap: {},
  options: { disabledDetectors: ['PathDetector', 'UrlDetector'] },
});
```

That `{}` is deliberate. The point of `inspect` is to show what the scrubber would do today, not what it did historically. A user pasting a draft prompt gets an accurate preview; a user pasting the same prompt three times in a row gets the same preview each time, even if the live session had built up a mapping that would change the placeholder numbers.

The output renders a small boxed panel with three sections: the original text, the text that would be sent to the LLM, and a numbered list of detected identifiers mapping placeholder to original. If nothing is detected, the panel is replaced with the plain message "No sensitive identifiers detected in the input."

There is no second subcommand in v1.29.0. `inspect` is the one; the other surfaces (rule-packs management, session management) live in the package CLI, not in Nanocoder.

## What this release does and does not defend against

The package's threat model is the same one Nanocoder inherits, so it is worth restating the boundary clearly.

`PrivacyContext` defends against identifying content leaking into the prompt body: emails, phones, paths, URLs, API keys, tokens, postal addresses, and (if enabled) names and code identifiers. It defends against cross-turn identifier correlation within a single session by reusing placeholders. It defends against tool-call argument leakage by rehydrating in place rather than relying on the model to guess what `Path_3` was.

It does not defend against a compromised local machine. The session map is plaintext, in memory, but it is still on the box. It does not defend against stylistic fingerprinting: how the user phrases things, the cadence of their questions, the words they choose. It does not defend against semantic leakage: a question that is itself identifying cannot be made anonymous by stripping identifiers from it. And it does not see the network. A user who needs network-layer privacy composes this with a network tool of their own choosing; the scrubber has no opinion about which one.

The cloud-side reasoning is the same. The provider sees placeholders, not values. It can still see that you pasted a URL-shaped string (`Url_` detectors are off in agent context). It can still see the shape of your prompt, the size of your codebase, and the structure of your tool calls. What it does not see, by default, is the identifying content. That is the trade this feature makes: more of your prompt becomes opaque to a third party, in exchange for a meaningful reduction in how much of it is identifying.

## Composability with the rest of the release

A few things in 1.29.0 change how you should think about privacy mode:

- The native VS Code GUI (the headline feature) uses the same `handleChat` plumbing as the terminal UI, so scrubbing applies uniformly across both. There is no separate privacy code path for the GUI.
- The stateless API with history-boundary rehydration pairs well with scrubbing. Because history is rehydrated at history boundaries, a rehydrated history is the same shape the AI SDK would have built from a fresh conversation, and the scrub pipeline does not need to know which messages came from a resumed session vs a fresh one.
- Subagents inherit the parent's `PrivacyContext` by virtue of inheriting the parent's `appState`. A subagent that runs in the same process will see the same placeholders and rehydrate the same way. There is no separate per-subagent session map yet; that is a deliberate choice in v1.29.0, because per-subagent maps would create per-subagent identity islands that the cloud provider could join.

## What we will iterate on

The architecture above is the v1.29.0 baseline. Things we are likely to change:

- The session-map lifecycle. Today it is `useRef({})` for the lifetime of the app. A longer-lived session store, possibly encrypted at rest, would let a user resume a privacy-protected session across restarts without losing the placeholder stability. The threat model calls this out as v1.1.
- Optional detector packs. Rule packs are package-level today; we will not enable them inside Nanocoder until the security review is done. Users who need custom detectors can use the package CLI directly.
- A `NameDetector` opt-in with strict mode, exposed as a preference. The detector is off by default because the false-positive rate is non-trivial, but there are workflows (legal, medical, finance) where it earns its keep.

If you find a case where the scrub pipeline breaks a legitimate tool call, or where the placeholder mapping is too aggressive, please open an issue. The scrub-and-rehydrate path is well-isolated, which means the iteration loop is small: a fix in `chat-handler.ts` or in the package, a regression test, and we ship.

Repo, docs, and the package behind it all live at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).
