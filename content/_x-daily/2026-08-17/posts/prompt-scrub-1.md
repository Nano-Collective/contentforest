---
kind: x-daily
date: "2026-08-17"
source: "prompt-scrub"
channel: x
angle: "Tool results scrub too"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 247
---

Secrets don't only arrive in the prompt. They arrive in the next turn, inside the ls, git log, and cat results the agent reads back. That's why prompt-scrub runs on every message, not just the user one. Tool results are where the leaks accumulate.