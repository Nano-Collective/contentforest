---
kind: x-daily
date: "2026-08-17"
source: "json-up"
channel: x
angle: "Unversioned data is v0"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 265
---

Your old JSON already has a version: 0.

json-up treats any document missing a `_version` as v0 and runs every prior migration in sequence on first read. Drop the file in and the migrations walk it forward, no pre-edit, no wrapper, no rewrite of legacy data first.
