---
product: nanocoder
version: "1.29.0"
channel: reddit
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 5754
---

A thing we shipped in Nanocoder v1.29.0 that I think is worth talking about on its own, separate from the headline features: a privacy-aware prompt scrubbing layer. The short version is that when you point Nanocoder at a cloud model on a private codebase, the cloud model now only ever sees placeholders for the identifying bits of your prompt, and the local agent sees the real values back.

The longer version is interesting because of the trade-offs.

## The setup

The actual scrubbing logic is a standalone package called `@nanocollective/prompt-scrub`. It exposes a `scrub()` function that runs a set of pluggable detectors (email, phone, secret, address, plus opt-ins for names and code identifiers) over a string, replaces matched spans with stable placeholders (`Email_1`, `Secret_1`, etc.), and updates a session map that the same package uses to `rehydrate()` placeholders back to the original text on the other side.

In v1.29.0, we wired that package into the chat request path in `chat-handler.ts`. The integration point is exactly one place, just before the AI SDK builds the request: we scrub the system prompt, scrub each non-tool message, hand the scrubbed text to the SDK, and when the response comes back we rehydrate the assistant text, the reasoning, and every tool-call argument. The placeholders are never visible to the model as opaque strings; to the model they look like real identifiers that the agent then uses.

## Where the design got interesting

Two decisions took more iteration than I expected.

The first was which detectors to run in the agent context. The package's defaults catch paths and URLs because they are often identifying. In an agent context, though, every prompt already contains paths (your repo, the file you asked it to edit) and URLs (from `npm install`, `git log`, your `package.json`). If we scrubbed those, the agent would not be able to refer to `Path_3` in a tool call and have the tool execute against the real path. We disabled `PathDetector` and `UrlDetector` at the call site, with `options: { disabledDetectors: ['PathDetector', 'UrlDetector'] }` on every scrub call, so cloud providers still see you pasted an absolute path, but they do not see your emails or API keys. That is the trade-off: a small amount of metadata leakage stays in exchange for the agent continuing to work.

The second was where to put the session map. The package's docs describe writing the placeholder map to disk in the user's config directory so `Email_1` is stable across sessions. We do not. The placeholder map is sensitive data in its own right (it carries the original values), and an in-process `useRef` is enough for one Nanocoder session. When the app exits, the map goes with it. We have not invented encryption at rest; we have just not written the secret values to disk in the first place.

## Stable placeholders

Stable placeholders within a session are the part that makes the feature feel less like a one-off rewrite and more like a substitution model. The cloud provider sees the same `Email_1` referenced across every turn, which means it cannot correlate identities across turns by linking `Email_3` in turn 1 to `Email_7` in turn 5. The local agent also benefits: its memory of who "the customer" is does not get fragmented across six renames of the same email in the conversation.

Across sessions the mapping is not stable. The provider cannot join `Email_1` from yesterday's run to `Email_1` from today's. The package's threat model is explicit about the boundary: stable session mappings address identifier-level correlation within a session. They do not address stylistic fingerprinting, semantic leakage, or cross-session profiling.

## The notification

There is a small per-turn notification that fires when the session map grows. The shape is `Privacy active: scrubbed N new identifier(s)`, and `N` is the per-turn delta, not a running total. It fires only when there is a delta, so a long session where the same email recurs does not get spammed. There is no per-notification mute; the entire feature is opt-in via the `enablePromptScrubbing` preference.

## `/privacy inspect`

There is also a `/privacy inspect <text>` command for previewing what the scrubber would do without sending a chat turn. It runs the same `scrub()` with an empty `sessionMap: {}`, so the preview is deterministic, which means paste the same text three times and you get the same placeholders back. The output is a small panel with the original, the scrubbed version, and the placeholder-to-original mapping. Useful for drafting prompts that you want to look a certain way before sending.

## What this release does not defend against

The threat model is worth reading in full, but the short version is: this is a content-layer defense. It reduces identifying material in the prompt body and gives you per-turn visibility into what was caught. It does not see the network, does not defend against a compromised local machine, and does not strip style or semantic content from a question that is identifying on its own. If you need network-layer privacy, the right composition is this plus a network tool of your choosing, such as VPN, Tor, or a self-hosted relay. The scrubber has no opinion about which.

## Try it

Enable it via the `enablePromptScrubbing` preference (or run `/privacy inspect` for a preview without enabling). Scrubbed placeholders stay stable within a session, so re-prompts and follow-ups keep working without needing to re-identify the same customer or path 12 times.

Repo, docs, and the package behind it all live here:

https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.
