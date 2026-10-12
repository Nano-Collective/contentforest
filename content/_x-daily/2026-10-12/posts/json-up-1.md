---
kind: x-daily
date: "2026-10-12"
source: "json-up"
channel: x
angle: "ValidationError ships the Zod issues array"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 214
---

Generic "validation failed" is useless. json-up's ValidationError ships the Zod issues array, so `error.issues.map(i => i.path.join('.') + ': ' + i.message)` prints which field broke at which version, no guesswork.
