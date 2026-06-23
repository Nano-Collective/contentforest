---
kind: x-daily
date: "2026-06-18"
source: "json-up"
channel: x
angle: "Type inference across the migration chain"
generated_at: "2026-06-18T04:59:54.471Z"
model: "minimax-m3"
char_count: 240
distributed_at: "2026-06-18T17:34:34.059Z"
---

Each `up` function in json-up is typed from the previous step output. Rename a field in v2 and downstream references break at compile time. Type safety travels with the chain, not just the schemas. https://github.com/Nano-Collective/json-up