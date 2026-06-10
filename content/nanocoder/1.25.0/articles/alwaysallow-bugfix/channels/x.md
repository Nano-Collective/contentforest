---
product: nanocoder
version: "1.25.0"
channel: x
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

v1.25.0 fixed alwaysAllow for bash. Three bugs: config loader ignored top-level alwaysAllow, permission check only checked one field, non-interactive mode reset the state. Closes #431. https://github.com/Nano-Collective/nanocoder