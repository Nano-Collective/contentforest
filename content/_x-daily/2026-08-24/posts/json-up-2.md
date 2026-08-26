---
kind: x-daily
date: "2026-08-24"
source: "json-up"
channel: x
angle: "ValidationError names the field that broke"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 193
---

"Validation failed" with no field path is a grep you didn't budget for. json-up's `ValidationError` carries the `issues` array, so the offending field is named in the message you already have.
