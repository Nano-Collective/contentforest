---
kind: x-daily
date: "2026-10-19"
source: "prompt-scrub"
channel: x
angle: "confidence-table-sets-the-floor"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 259
---

0.99 on a `sk-` key. 0.90 on a Bearer token. 0.70 on `API_KEY=`. 0.60 on high-entropy. prompt-scrub's confidence table is the floor for `--min-confidence`: anything below the secret-prefix score lets the leak the detector was tuned to catch straight through.