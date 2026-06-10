---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.25.0 replaced the monolithic `main-prompt.md` with a modular prompt architecture. System prompt sections are now individual files under `source/app/prompts/sections/`, and a `prompt-builder` assembles the final prompt dynamically based on the current mode.

The practical result: the system prompt is now auditable and incrementally modifiable without hunting through a single large file. Each mode (normal, auto-accept, plan, scheduler) gets only the sections and tools relevant to it.

A `generate-system-prompts` script is included for offline token counting and prompt inspection. You can review what Nanocoder is actually telling the model before it runs.

Why this matters for operators: if you've ever wanted to understand or tweak what the agent knows about your project, file operations, or task management, the sections are now readable in isolation.

More context in the full docs: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.