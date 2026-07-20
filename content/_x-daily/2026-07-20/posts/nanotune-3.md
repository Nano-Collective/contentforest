---
kind: x-daily
date: "2026-07-20"
source: "nanotune"
channel: x
angle: "The judge is a config, not a feature"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 252
---

An open-ended eval you can't re-run isn't an eval. In Nanotune the LLM judge is a config: provider, model, criteria, threshold in `.nanotune/judge.json`, plugged into a benchmark with `"match": "llm-judge"`. Open-ended now reproduces like string-match.