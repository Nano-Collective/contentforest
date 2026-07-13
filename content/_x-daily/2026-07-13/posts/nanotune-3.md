---
kind: x-daily
date: "2026-07-13"
source: "nanotune"
channel: x
angle: "Validate before you train"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 257
---

A fine-tune producing nonsense almost always traces back to silent data bugs. Run `nanotune data validate` before `nanotune train`: duplicates, broken role alternation in multi-turn JSONL, missing context messages. Seconds of work, hours of debugging later.