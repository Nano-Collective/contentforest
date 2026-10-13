---
kind: x-daily
date: "2026-10-12"
source: "prompt-scrub"
channel: x
angle: "Sessions are JSON on disk under XDG paths"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 243
---

A privacy tool that writes to disk by default sounds wrong. prompt-scrub does it anyway: each session is one JSON file in the OS config dir, so the same email gets the same placeholder on the next run. Files prune themselves after 7 days idle.
