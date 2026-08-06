---
kind: x-daily
date: "2026-07-27"
source: "nanotune"
channel: x
angle: "Loss divergence is the early stop signal"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 273
distributed_at: "2026-08-06T13:38:30.748Z"
---

Validation loss climbing while training loss drops isn't progress. It's overfitting. Nanotune's training display shows both side by side, so you see the gap. The fix: cut iterations (150 to 100 to 75) or learning rate (5e-5 to 2e-5), and the next benchmark run reflects it.
