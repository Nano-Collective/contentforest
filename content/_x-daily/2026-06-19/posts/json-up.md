---
kind: x-daily
date: "2026-06-19"
source: "json-up"
channel: x
angle: "Build the chain from standalone pieces"
generated_at: "2026-06-19T05:22:36.439Z"
model: "minimax-m3"
char_count: 260
---

json-up: when migrations live in their own files, wrap each in `createMigration` (or `createAsyncMigration`) so TS infers it. Feed the result into `createMigrations().add(...).build()` and the whole chain stays typed. https://github.com/Nano-Collective/json-up