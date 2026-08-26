---
kind: x-daily
date: "2026-08-17"
source: "nanotune"
channel: x
angle: "The recommended starting recipe"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 249
---

Fine-tuning has too many knobs to guess from zero. Nanotune ships a starting recipe: 150 iterations, learning rate 5e-5, batch size 4. A known-good default for 0.5B-1.5B models on 100-500 examples, so you tune from a real baseline instead of vibes.