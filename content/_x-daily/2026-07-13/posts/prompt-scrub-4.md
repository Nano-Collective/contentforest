---
kind: x-daily
date: "2026-07-13"
source: "prompt-scrub"
channel: x
angle: "Tool results get scrubbed too"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 272
---

Your `ls` output is part of your prompt. So is `git log`, `cat`, and `grep`.

prompt-scrub runs on every message regardless of origin. Tool results get scrubbed before the next LLM turn, not just what you typed.

The leak surface is the whole conversation, not the user input.