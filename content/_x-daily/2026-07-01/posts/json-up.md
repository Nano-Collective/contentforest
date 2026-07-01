---
kind: x-daily
date: "2026-07-01"
source: "json-up"
channel: x
angle: "use the async builder from day one"
generated_at: "2026-07-01T04:52:12.745Z"
model: "minimax-m3"
char_count: 278
---

Every migration up function is sync today, until one isn't. Start with createAsyncMigrations() in json-up so the day you need to await a config fetch or file read, you change one declaration instead of rebuilding the type chain. A future async step costs a line, not a refactor.