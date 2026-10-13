---
kind: x-daily
date: "2026-10-12"
source: "nanocoder"
channel: x
angle: "Auto profile picks minimal or nano from model size"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 263
---

Two thresholds, one config flag. nanocoder's auto profile reads the model id: under 4B params gets the 5-tool nano profile and a 150-250 token prompt, up to 15B gets the 8-tool minimal profile. Above that, full surface, no flag needed. The prompt stops trailing the hardware.
