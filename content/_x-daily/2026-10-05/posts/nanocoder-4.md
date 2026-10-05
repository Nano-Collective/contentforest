---
kind: x-daily
date: "2026-10-05"
source: "nanocoder"
channel: x
angle: "Hooks run before the tool call, not after"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 230
---

"Never touch .env" lives in the prompt until the model forgets. nanocoder's `pre-tool-use` runs a shell command before every tool call with `$NANOCODER_FILE` in env. Non-zero exit denies the call. The rule is enforced, not taught.