---
kind: x-daily
date: "2026-06-19"
source: "nanotune"
channel: x
angle: "Read the loss curve, then tune"
generated_at: "2026-06-19T05:22:36.439Z"
model: "minimax-m3"
char_count: 270
distributed_at: "2026-06-22T08:19:54.646Z"
---

Read the loss curve, then tune. Nanotune defaults: 150 iters, 5e-5 LR, batch 4. Train and val should fall together, ending ~0.1-0.3. Val rises, train keeps falling = overfit, cut iters. Both flat = underfit, push iters or LR.

https://github.com/Nano-Collective/nanotune
