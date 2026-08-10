---
kind: x-daily
date: "2026-08-10"
source: "json-up"
channel: x
angle: "Async migrations only where they pay"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 269
---

A chain of sync migrations doesn't need Promise overhead. Mark up() async only when it actually awaits - a fetch, a key call. The createMigrations / createAsyncMigrations split keeps a 100-example benchmark from silently doubling its runtime on an unused async keyword.