---
kind: x-daily
date: "2026-09-07"
source: "nanocoder"
channel: x
angle: "scheduler-feature-is-a-skill-now"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 277
---

`/schedule create|add|start` and `schedules.json` are gone. The nanocoder scheduler used to be its own subsystem because subscriptions didn't exist yet. Now `subscribe: schedule.cron` on a command frontmatter fires through the same daemon. A subsystem became a frontmatter key.
