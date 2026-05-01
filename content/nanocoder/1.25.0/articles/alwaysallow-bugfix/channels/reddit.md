---
product: nanocoder
version: "1.25.0"
channel: reddit
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

v1.25.0 fixed a fun one: `alwaysAllow: ["execute_bash"]` in your config was being silently ignored. Three separate bugs had to be fixed, each in a different part of the codebase, which is why they all shipped separately.

The short version: config loading wasn't reading the top-level `alwaysAllow` field, the permission-check function only looked at the MCP subfield, and non-interactive mode was resetting the permission state after it had been checked.

If you had bash set to auto-allow and were still getting prompted — this was the reason. Should be fixed now. Closes #431.

Full write-up on the GitHub: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.
