---
kind: x-daily
date: "2026-07-06"
source: "json-up"
channel: x
angle: "Zod + migrations as one library"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 279
distributed_at: "2026-07-13T11:48:09.048Z"
---

Most of your JSON lives between versions, not at them. Migration tools don't validate, validators don't migrate. json-up treats them as one thing: each migration step carries its own Zod schema, so the shape that comes out is the shape you asked for, not the shape you hoped for.