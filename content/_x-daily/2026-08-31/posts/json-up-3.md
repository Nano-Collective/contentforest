---
kind: x-daily
date: "2026-08-31"
source: "json-up"
channel: x
angle: "Validation guards every step"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 241
---

1 schema per migration step. json-up validates each up() output against its own Zod schema before the next migration runs, and ValidationError names the version that broke. A silently corrupted field cannot pass through the chain undetected.
