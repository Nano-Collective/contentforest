---
kind: x-daily
date: "2026-10-19"
source: "nanotune"
channel: x
angle: "two-seeds-do-different-things"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 269
---

Two flags, two jobs. Nanotune's `train` has `--seed` for the train/validation split (only fires on the run that creates valid.jsonl) and `--train-seed` for the mlx_lm run itself (shuffling, dropout, LoRA init). Both reject a non-integer instead of silently coercing it.