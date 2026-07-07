---
kind: x-daily
date: "2026-07-06"
source: "prompt-scrub"
channel: x
angle: "Tool call results are also prompts"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 252
---

Your agent's tool outputs become its next prompt. `ls`, `git log`, `cat`, `grep` all flow back into the model, full of usernames, paths, and URLs - and most scrubbers only watch the user side. prompt-scrub scrubs every message regardless of origin.