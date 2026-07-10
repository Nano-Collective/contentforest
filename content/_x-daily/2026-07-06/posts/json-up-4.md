---
kind: x-daily
date: "2026-07-06"
source: "json-up"
channel: x
angle: "Custom version key"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 241
distributed_at: "2026-07-10T14:54:24.135Z"
---

Your JSON already has a version field and the convention is wrong. Rename it and every reader breaks. json-up lets you pass `key: 'version'` (or anything else) to migrate over it as-is, so the schema catches up without a breaking rename.