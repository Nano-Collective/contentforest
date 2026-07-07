---
kind: x-daily
date: "2026-07-05"
source: "json-up"
channel: x
angle: "v2 schema types v3's up input"
generated_at: "2026-07-05T04:18:03.370Z"
model: "minimax-m3"
char_count: 167
distributed_at: "2026-07-06T12:33:36.870Z"
---

Your migration `up` function's `data` argument looks like `unknown`. It isn't. json-up threads each step's Zod schema through, so a typo fails the build, not the user.
