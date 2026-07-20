---
kind: x-daily
date: "2026-07-20"
source: "nanocoder"
channel: x
angle: "Tune is the runtime layer small models actually need"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 274
---

A 4B model forgetting the question by the second tool call isn't a model problem. It's a prompt problem. Nanocoder's `/tune` `nano` profile shrinks the system prompt from ~700 to ~150 tokens and drops MCP tool sprawl, which is why a small model can actually finish the loop.
