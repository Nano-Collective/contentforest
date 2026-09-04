---
product: nanocoder
version: "1.29.0"
channel: linkedin
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 1743
distributed_at: "2026-09-04T12:01:11.959Z"
---

Nanocoder v1.29.0 ships a privacy-aware prompt scrubbing layer we have wanted for a while. When you point Nanocoder at a cloud model on a private codebase, the model only sees placeholders for the identifying bits of your prompt. Locally, the placeholders resolve back to the values the agent actually needs.

Three things are in the box. A new `PrivacyContext` that runs in the chat request path, just before the AI SDK builds the request. A `/privacy` command for inspecting what would be scrubbed. A per-turn notification when at least one new identifier is detected, so you see when the feature is doing something.

Built on the standalone `@nanocollective/prompt-scrub` library, the scrub pipeline runs the secret, email, phone, and address detectors by default. `PathDetector` and `UrlDetector` are explicitly disabled in the agent context because every prompt already contains paths and URLs the agent needs to keep working with. Stable placeholders (`Email_1`, `Secret_1`) are reused within a session so the cloud provider cannot correlate identities across turns.

Rehydration runs on the assistant text, the reasoning, and every tool-call argument. The model sees placeholders while generating; the agent sees real values while executing. The session map lives in memory for the lifetime of the app, never on disk.

It is a content-layer defense: it reduces what identifying material reaches the cloud, and it composes with a network-layer tool of your own choosing if you need more. The full deep dive on the architecture and the design trade-offs is in the GitHub Discussion linked below.

#OpenSource #AI

[Repo and docs](https://github.com/Nano-Collective/nanocoder), built by the [Nano Collective](https://nanocollective.org).
