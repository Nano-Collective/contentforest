---
kind: x-daily
date: "2026-07-20"
source: "json-up"
channel: x
angle: "Migrations are chainable async or sync, mixed"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 241
---

Most migration APIs force an all-or-nothing choice: sync or async, end to end.

json-up's createAsyncMigrations() does not. Each up() can be sync or async, freely mixed in one chain. Adopt async work one migration at a time, no global rewrite.