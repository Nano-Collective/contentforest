---
kind: x-daily
date: "2026-06-28"
source: "json-up"
channel: x
angle: "Zod validates at every step"
generated_at: "2026-06-28T04:47:49.980Z"
model: "minimax-m3"
char_count: 231
---

Most JSON migration tools validate the final shape and give you a diff with no clue where it broke. json-up runs the declared Zod schema after every up() call, so ValidationError carries the exact version and the Zod issues for it.
