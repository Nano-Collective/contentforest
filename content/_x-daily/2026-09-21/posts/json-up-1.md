---
kind: x-daily
date: "2026-09-21"
source: "json-up"
channel: x
angle: "Validation after every step"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 251
---

Stop trusting that your up() returned what the next version expects. In json-up, each migration carries its own Zod schema and it runs against the output of every up() before the next step sees it. Drift fails at the version it broke, not three later.
