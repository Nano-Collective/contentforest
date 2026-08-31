---
kind: x-daily
date: "2026-08-31"
source: "json-up"
channel: x
angle: "Sync and async chain in one builder"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 236
---

You don't have to pick a builder type before you know which migrations need I/O. `createAsyncMigrations` in `json-up` takes sync and async `up()` functions in the same chain, so only the steps that actually await something pay the cost.
