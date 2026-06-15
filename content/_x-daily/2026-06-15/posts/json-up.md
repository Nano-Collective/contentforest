---
kind: x-daily
date: "2026-06-15"
source: "json-up"
channel: x
angle: "Migrate data that has no version yet"
generated_at: "2026-06-15T05:26:10.593Z"
model: "minimax-m3"
char_count: 235
---

Old JSON files with no `_version` field are treated as version 0. `json-up` runs the full migration chain, so legacy data lands at the latest typed schema without a hand-rolled bootstrap step. https://github.com/Nano-Collective/json-up
