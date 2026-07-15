---
kind: x-daily
date: "2026-07-13"
source: "json-up"
channel: x
angle: "Three named error types"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 174
distributed_at: "2026-07-15T11:36:09.939Z"
---

Parsing error messages in a catch block is a smell. json-up throws 3 named errors - ValidationError, MigrationError, VersionError - so you branch on the type, not the string.
