---
product: nanotune
version: "1.6.0"
channel: hacker-news
title: "nanotune v1.6.0: Nanotune works without a terminal"
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 250
---

1.6.0 fixes the long-standing "Nanotune crashes every time it does not have a TTY" bug, including for read-only commands that never needed a keypress. Pipes, CI, and Docker (without `-t`) all work now. Full write-up: {{link to article on website}}
