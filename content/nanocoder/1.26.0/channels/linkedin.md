---
product: nanocoder
version: "1.26.0"
channel: linkedin
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
distributed_at: "2026-05-11T22:32:34.343Z"
---

Nanocoder v1.26.0 is out.

This release lands three notable additions. **Nano mode** is a new tool profile under `/tune` built for the smallest open-weights models or low-end hardware. It brings the system prompt down to roughly 150-250 tokens, compared to 500-700 in minimal mode, and includes a hardware-tuned preset and an AGENTS.md toggle.

**Reasoning traces** are now rendered in real time. Reasoning content from models like Codex GPT-5 and DeepSeek-R1 streams as a collapsible Thought block, persists across history, and logs correctly. `Control+R` toggles expansion, and the Display Settings panel handles default behaviour.

**Non-interactive mode** gets a `--plain` flag that strips Ink rendering entirely, making output suitable for CI pipelines, scripts, and pipes. Exit codes are deterministic and stdin/stdout are handled cleanly.

Beyond those, there is a rework of the VS Code extension integration, a `/rename` command for chat sessions, a `defaultMode` config option, custom system prompt support, per-provider and per-model context window overrides, a `disabledTools` config option, and a new Display Settings panel with thinking and tool-result toggles.

There are also 12+ new themes.

See the full changelog for the complete list of changes and all the bug fixes.

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

https://github.com/Nano-Collective/nanocoder
