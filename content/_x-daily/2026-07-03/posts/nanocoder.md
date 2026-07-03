---
kind: x-daily
date: "2026-07-03"
source: "nanocoder"
channel: x
angle: "Mention a line range, not a whole file"
generated_at: "2026-07-03T04:06:21.656Z"
model: "minimax-m3"
char_count: 251
---

Asking @ to dump a 2,000-line file into context is a fast way to lose the room you needed for actual work. Nanocoder takes a line range: src/utils.ts:45-80. The model sees the slice you cared about, your context stays lean for the rest of the session.