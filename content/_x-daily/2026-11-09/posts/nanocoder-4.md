---
kind: x-daily
date: "2026-11-09"
source: "nanocoder"
channel: x
angle: "Guardrails as shell, not as prompts"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 279
---

The default is to make every guardrail an LLM call, then hope the model remembers the rule.

Nanocoder runs pre-tool-use hooks as shell commands instead. Deterministic, free, no daemon, and a non-zero exit vetoes the tool.

"Never touch .env" belongs in the hook, not the prompt.
