---
kind: x-daily
date: "2026-10-19"
source: "json-up"
channel: x
angle: "unversioned-data-treated-as-v0"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 249
---

Old records don't carry a version field, and the migrator has to guess where they sit. json-up treats unversioned state as v0, so the first up() decides how to absorb the old shape and the version error never lies about why a record was left behind.