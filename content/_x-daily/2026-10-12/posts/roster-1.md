---
kind: x-daily
date: "2026-10-12"
source: "roster"
channel: x
angle: "App private key never touches disk or the process table"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 262
---

A leaked App private key is a revoke-the-app day, not a rotate-the-secret day. `roster` (alpha) holds it in memory and pipes it to `gh secret set` on stdin: no file, no argv, no process table. A failed write means generating a new key from the App settings page.