---
kind: x-daily
date: "2026-08-10"
source: "nanocoder"
channel: x
angle: "Daemon listens for file changes"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 262
---

File watchers that only run while your terminal is open aren't file watchers. nanocoder's daemon exists because subscriptions need to outlive the TUI: file.changed and schedule.cron tick on their own clock, install as a user service, run triggered work headless.