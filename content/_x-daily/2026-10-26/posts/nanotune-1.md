---
kind: x-daily
date: "2026-10-26"
source: "nanotune"
channel: x
angle: "Two seeds that do different jobs"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 272
---

A seed flag that does nothing is worse than no flag. nanotune --seed only creates the train/validation split, so once valid.jsonl exists it is a no-op and the run says so. --train-seed seeds mlx_lm and applies every time. Both reject a non-integer rather than coercing it.
