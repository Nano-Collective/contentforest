---
kind: x-daily
date: "2026-07-13"
source: "json-up"
channel: x
angle: "Version in the data, not in the DB"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 279
distributed_at: "2026-07-16T16:18:34.302Z"
---

The reflex for JSON versioning is a schema table in the database next to the rows. json-up puts `_version` on the data itself and treats unversioned input as v0. The migration ships with the file, no schema table, no coupling, works the same on disk, in a blob, in a local store.
