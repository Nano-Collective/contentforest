---
kind: x-daily
date: "2026-09-21"
source: "json-up"
channel: x
angle: "Three errors that each name the cause"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 253
---

`migrate()` threw. The stack says "Error" and nothing about which version or why. json-up splits it: ValidationError for schema drift, MigrationError carries the original cause, VersionError for bad ordering. Catch the right one and the fix is one line.
