---
kind: x-daily
date: "2026-07-20"
source: "json-up"
channel: x
angle: "ValidationError points at the path, not the message"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 277
---

A migration throws and the stack trace tells you nothing about which field broke. json-up's ValidationError carries a Zod issues array, so error.issues.forEach(i => console.error(i.path.join('.'), i.message)) prints the exact path and message - the catch tells you what to fix.
