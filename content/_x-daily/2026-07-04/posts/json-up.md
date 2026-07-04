---
kind: x-daily
date: "2026-07-04"
source: "json-up"
channel: x
angle: "Each up runs the schema"
generated_at: "2026-07-04T03:59:04.177Z"
model: "minimax-m3"
char_count: 234
---

Your migration is only as good as the shape your data lands in. json-up runs each up() output through the next version's Zod schema, so drift throws ValidationError with the version and the field path, not a silent broken next step.