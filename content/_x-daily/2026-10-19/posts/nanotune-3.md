---
kind: x-daily
date: "2026-10-19"
source: "nanotune"
channel: x
angle: "bad-flags-die-at-the-cli"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 276
---

Most CLIs see `--samples 5x` and quietly run a single sample. Your benchmark then reports a score under settings you didn't pick. Nanotune `train` and `benchmark` reject the typo outright and name the flag in the error, so the number comes from the run you actually asked for.