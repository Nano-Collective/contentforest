---
kind: x-daily
date: "2026-10-19"
source: "nanotune"
channel: x
angle: "seed-re-split-needs-cleanup"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 270
---

Pass `--seed 7` to a re-run expecting a different split and nothing moves. That's deliberate, not stuck. nanotune `train` only seeds the split on creation; once `valid.jsonl` exists the seed is left alone and the CLI tells you so. Delete `valid.jsonl` first to re-split.
