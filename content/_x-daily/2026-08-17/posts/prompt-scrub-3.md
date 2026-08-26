---
kind: x-daily
date: "2026-08-17"
source: "prompt-scrub"
channel: x
angle: "Scrub happens after every tool call"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 224
---

Your agent reads `ls /Users/me/work` and the next turn has your full path tree. Same for `cat deploy.yml`. prompt-scrub scrubs every message, user prompt and tool result, so the LLM sees `Path_1` instead of `/Users/me/work`.
