---
kind: x-daily
date: "2026-10-12"
source: "nanotune"
channel: x
angle: "The judge is a config, not a hack"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 241
---

500 examples, one scoring change to test. nanotune keeps the judge in `.nanotune/judge.json`, schema-validated and versioned with the run dir. Three fields to swap. Same scoring on every pass through the dataset, and every change shows up in the diff.
