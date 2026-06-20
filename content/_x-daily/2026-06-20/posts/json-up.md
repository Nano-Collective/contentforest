---
kind: x-daily
date: "2026-06-20"
source: "json-up"
channel: x
angle: "Zod schema checks what the up function returns"
generated_at: "2026-06-20T04:39:51.008Z"
model: "minimax-m3"
char_count: 245
---

Each json-up migration pairs up() with a Zod schema. If the output doesn't match the next version's shape, ValidationError.issues pinpoints the exact field path. Failure is fast and named, not silent.

https://github.com/Nano-Collective/json-up
