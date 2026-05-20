---
product: nanocoder
version: "1.26.0"
channel: linkedin
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
wont_use_at: "2026-05-20T12:19:48.375Z"
---

Nanocoder v1.26.0 streams reasoning content from reasoning models in real time — but the release note is a one-liner. The engineering behind it had several iterations worth knowing about if you use reasoning models with Nanocoder.

The issues that were fixed post-initial-release:

`Control+R` did not restore reasoning on follow-up turns. Reasoning was not being persisted in history, so toggling expansion off and on lost it. Fixed by storing reasoning on `assistantMsg` so it survives across turns.

Codex GPT-5 reasoning did not render at all. The API defaults were not set, so GPT-5 reasoning effort was zeroed out. Fixed by explicitly setting `reasoningSummary=auto` and `reasoningEffort=medium` in the AI SDK options.

Ghost Echo on the reasoning path. `<think>` content was not stripped on the native tool-calling path, so reasoning leaked into the rendered output. Fixed by stripping `<think>` tags on the native path.

Three control points for the UI: `Control+R` toggles expansion live. Display Settings (`/settings` → "Tool Results and Thinking") sets the default. Tune menu `expandedReasoning` sets per-session override.

Available in v1.26.0.

https://github.com/Nano-Collective/nanocoder