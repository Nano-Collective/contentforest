---
kind: x-daily
date: "2026-09-07"
source: "json-up"
channel: x
angle: "zod-schema-drives-validation-and-types"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 204
---

One schema should own the whole contract. json-up's Zod schema does: it validates each migration's output at runtime and infers the TS types end-to-end, so the type you read is the shape you actually get.
