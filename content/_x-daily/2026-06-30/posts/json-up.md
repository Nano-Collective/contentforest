---
kind: x-daily
date: "2026-06-30"
source: "json-up"
channel: x
angle: "Version 0 is unknown, not your v1 schema"
generated_at: "2026-06-30T04:23:09.209Z"
model: "minimax-m3"
char_count: 275
distributed_at: "2026-07-01T14:23:29.317Z"
---

Version 0. That's what json-up calls your data when `_version` is missing. Not v1, not "almost v1". The first `up()` gets raw data, not what your v1 zod schema promised, because legacy writes can't be trusted to fit anything. So your migration coerces `unknown` into shape.