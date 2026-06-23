---
kind: x-daily
date: "2026-06-22"
source: "json-up"
channel: x
angle: "Rename a field without losing the value"
generated_at: "2026-06-22T05:28:23.488Z"
model: "minimax-m3"
char_count: 248
distributed_at: "2026-06-22T08:35:46.434Z"
---

Renaming a field without losing it: v2 schema is z.object({ username: z.string() }), and up() maps the old userName across. The chain is type-inferred, so userName is gone from the compile-time view at v2. https://github.com/Nano-Collective/json-up