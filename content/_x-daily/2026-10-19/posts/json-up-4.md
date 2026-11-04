---
kind: x-daily
date: "2026-10-19"
source: "json-up"
channel: x
angle: "migrate-returns-a-new-shape"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 268
---

Most migration helpers mutate state in place. If the run throws halfway, your record is half-written and the next read misinterprets it. json-up's migrate() and migrateAsync() return a new shape and leave the input alone. Old version stays put until you write it back.