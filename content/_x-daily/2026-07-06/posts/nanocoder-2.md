---
kind: x-daily
date: "2026-07-06"
source: "nanocoder"
channel: x
angle: "Model-callable tools as markdown"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 231
---

Your tool's parameter values get shell-quoted before they hit the body, so even '; rm -rf /; #' lands in echo as one literal string. nanocoder custom tools block injection at the template layer, not by trusting the model to behave.