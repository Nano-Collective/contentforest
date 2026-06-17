---
kind: x-daily
date: "2026-06-17"
source: "json-up"
channel: x
angle: "Mix sync and async in one chain"
generated_at: "2026-06-17T05:12:27.302Z"
model: "minimax-m3"
char_count: 234
distributed_at: "2026-06-17T14:22:48.114Z"
---

json-up lets sync and async `up()` live in the same chain. `createAsyncMigrations` + `migrateAsync` await the steps that need a network call; the rest stay synchronous. One chain to maintain. https://github.com/Nano-Collective/json-up
