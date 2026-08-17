---
kind: x-daily
date: "2026-08-17"
source: "json-up"
channel: x
angle: "Repurpose an existing version field"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 221
---

Your data already tracks a version under whatever name you picked. `json-up` does not ask you to rename it. Pass key: "version" (or "schemaVersion", or anything else) to migrate() and the library reads yours, not its own.