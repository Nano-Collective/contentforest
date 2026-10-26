---
kind: x-daily
date: "2026-10-26"
source: "prompt-scrub"
channel: x
angle: "stdout stays clean for piping"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 227
---

A "Scrubbed: 2 entities" line in stdout breaks whatever you piped it into. prompt-scrub puts the scrubbed text on stdout and the receipt (count, session ID) on stderr, so the pipe stays clean and you still see what it replaced.
