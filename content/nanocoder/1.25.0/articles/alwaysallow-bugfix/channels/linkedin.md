---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.25.0 fixed a bug where `alwaysAllow` in `agents.config.json` was not being respected for bash commands. Three separate bugs combined to produce the failure.

Bug 1: top-level `alwaysAllow` was never loaded from the config file. Bug 2: the permission-check function only looked at the MCP-server subfield, not the top-level list. Bug 3: non-interactive mode was resetting the permission state after it had already been checked.

Each fix was in a different location in the codebase — which is why they passed individual review. Closes #431.

If you had `alwaysAllow: ["execute_bash"]` configured and were still seeing confirmation prompts, this release should resolve it. No config change needed.

More on the fix and what it means for operators: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.
