---
kind: x-daily
date: "2026-07-07"
source: "nanotune"
channel: x
angle: "Configure the judge before you train"
generated_at: "2026-07-07T04:14:58.542Z"
model: "minimax-m3"
char_count: 269
---

Training without a judge is just vibes. Run `nanotune judge configure` (pick provider + model), then `judge test` to confirm it scores. Tag open-ended tests with `"match": "llm-judge"` and a `passThreshold`. You get a per-criteria score with reasoning, not a thumbs-up.