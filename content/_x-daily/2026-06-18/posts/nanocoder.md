---
kind: x-daily
date: "2026-06-18"
source: "nanocoder"
channel: x
angle: "Subagents that run in parallel"
generated_at: "2026-06-18T04:59:54.471Z"
model: "minimax-m3"
char_count: 272
distributed_at: "2026-06-19T11:01:37.225Z"
---

Nanocoder's main agent can call the `agent` tool up to five times in a single response. The built-in `explore` subagent and others fan out in parallel, each with its own progress row, so research doesn't stall the main thread.

https://github.com/Nano-Collective/nanocoder
