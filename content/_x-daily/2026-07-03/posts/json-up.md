---
kind: x-daily
date: "2026-07-03"
source: "json-up"
channel: x
angle: "The version field is your data"
generated_at: "2026-07-03T04:06:21.656Z"
model: "minimax-m3"
char_count: 211
distributed_at: "2026-07-03T15:18:02.616Z"
---

Your data's version field isn't ours to rename. json-up defaults to `_version`, but `migrate({ key: 'schemaVersion' })` uses whatever your store already calls it. Library conforms to your shape, not the reverse.