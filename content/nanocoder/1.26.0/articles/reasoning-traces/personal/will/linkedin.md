---
kind: personal
member: will
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-10T21:59:28.274Z"
model: "minimax-m2.7"
char_count: 1327
---

Nanocoder v1.26.0 streams reasoning content from reasoning models in real time — but getting there took a few iterations. Here's what was fixed after the initial release.

Control+R didn't restore reasoning on follow-up turns. Reasoning was not being persisted in history, so toggling expansion off and on lost it. Fixed by storing reasoning on assistantMsg so it survives across turns.

Codex GPT-5 reasoning did not render at all. The API defaults were not set, so GPT-5 reasoning effort was zeroed out. Fixed by explicitly setting reasoningSummary=auto and reasoningEffort=medium in the AI SDK options.

Ghost Echo on the reasoning path. The think content was not stripped on the native tool-calling path, so reasoning leaked into the rendered output. Fixed by stripping think tags on the native path.

Three control points: Control+R toggles expansion live. Display Settings sets the default. The tune menu expandedReasoning gives you a per-session override.

Available in Nanocoder v1.26.0.

Credit to the team on the fixes — Brijesh K R, Deniz Okcu, Nassim Amar, Matthew Spence, Alexandru Spînu. Very pleased with how this came together.

More soon.

https://github.com/Nano-Collective/nanocoder
