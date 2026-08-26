---
kind: x-daily
date: "2026-08-24"
source: "prompt-scrub"
channel: x
angle: "Tool outputs are also prompts"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 254
---

You can scrub your message and still leak. `ls`, `cat`, `git log`, `grep` - whatever a tool prints is the next prompt, paths and all.

prompt-scrub scrubs every message regardless of origin, so identifiers in tool results never reach the next LLM turn.
