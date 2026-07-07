---
kind: x-daily
date: "2026-07-07"
source: "nanocoder"
channel: x
angle: "You decide what your agent can do"
generated_at: "2026-07-07T04:14:58.542Z"
model: "minimax-m3"
char_count: 232
---

A coding agent shouldn't get to choose its own reach. Nanocoder's top-level `disabledTools` array strips `agent`, `execute_bash`, or `web_search` from chat, subagents and every `/tune` profile, so the model never tries to call them.