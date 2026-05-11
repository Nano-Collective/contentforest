---
product: nanocoder
version: "1.26.0"
channel: reddit
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
distributed_at: "2026-05-11T22:51:33.433Z"
---

Nanocoder v1.26.0 is out. Here is what we shipped and why each addition made it in.

**Nano mode** is the big one for this release. If you have been running Nanocoder with a small open-weights model on modest hardware, you know the system prompt overhead can eat a meaningful chunk of your context window before the model says anything useful. Nano mode drops that overhead from roughly 500-700 tokens down to 150-250 tokens. It is a third profile in `/tune`, alongside the existing full and minimal profiles. It disables `find_files`, `list_directory`, and `agent`; cuts the section lengths down; and ships with a low-end hardware preset.

**Reasoning traces** are new. Models that emit reasoning content, such as Codex GPT-5, DeepSeek-R1-style, or Anthropic extended thinking, now have that content stream in real time as a collapsible Thought block above the response. It persists in history and appears in logs. Toggle it with `Control+R`. The Display Settings panel under `/settings` controls the default expansion state.

**Non-interactive mode** now has a `--plain` flag. This strips the Ink rendering layer entirely so output is clean for CI pipelines, scripts, and pipes. Exit codes are deterministic, stdin/stdout are handled properly, and there are no interactive prompts.

We also reworked the VS Code extension. The old "Ask Nanocoder" command is gone, replaced with a more natural context-on-focus flow. There is a `/rename` command for chat sessions, a `defaultMode` config option, custom system prompt support, per-model context window overrides, a `disabledTools` option, JSON tool fallback for open-weights models (Qwen, Kimi, GLM), `<function=...>` format support, and a new Display Settings panel. Plus 12+ new themes.

A breaking change this release: `nanocoderTools.alwaysAllow` has been removed. It duplicated the top-level `alwaysAllow` with no extra behaviour. Move any entries to the top-level `alwaysAllow` array in `agents.config.json`.

And a quick note on the toolchain: we bumped to Node.js 22 and pnpm 11 across CI, devcontainer, and `engines.node`. This fixes the `node:sqlite` crash some users hit with pnpm 11 on Node 20.

Full changelog on GitHub: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.
