---
kind: x-daily
date: "2026-08-10"
source: "prompt-scrub"
channel: x
angle: "Scrub every turn not just the prompt"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 231
---

A path leaks the moment you run `ls`. prompt-scrub takes the whole messages array, so every tool result and outgoing turn is scrubbed, not just the prompt you typed. One hook in the message handler, no rewiring around the LLM call.