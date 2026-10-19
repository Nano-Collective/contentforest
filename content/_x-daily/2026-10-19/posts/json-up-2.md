---
kind: x-daily
date: "2026-10-19"
source: "json-up"
channel: x
angle: "create-helpers-for-dynamic-chains"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 216
---

A migration loaded from a config map shouldn't lose its types. Skip createMigrations().add() and wrap each entry in createMigration() (or createAsyncMigration()). The schema and up() still drive the input and output.
