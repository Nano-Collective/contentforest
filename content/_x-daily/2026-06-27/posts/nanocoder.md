---
kind: x-daily
date: "2026-06-27"
source: "nanocoder"
channel: x
angle: "Nano tool profile prompt size"
generated_at: "2026-06-27T04:14:52.613Z"
model: "minimax-m3"
char_count: 266
distributed_at: "2026-06-29T09:40:30.051Z"
---

600 tokens of system prompt, and a 1B local model never gets to its first file. `nano` profile in Nanocoder cuts it to ~200 by dropping three tools, two prompt sections, and AGENTS.md. The difference between doing work and running out of context on the prompt alone.
