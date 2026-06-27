---
kind: x-daily
date: "2026-06-27"
source: "json-up"
channel: x
angle: "Sync and async freely mixed"
generated_at: "2026-06-27T04:14:52.613Z"
model: "minimax-m3"
char_count: 258
---

Most migration libraries make you pick a side: all sync, or all async, for the whole chain.

`json-up` doesn't. `createAsyncMigrations` lets sync and async `up()` functions sit in the same chain. Only the steps that actually need to await pay the async cost.