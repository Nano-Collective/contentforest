---
kind: x-daily
date: "2026-07-27"
source: "nanocoder"
channel: x
angle: "Schedules.json is dead, skills own cron now"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 272
---

Two systems for one job was the bug.

/schedule wrote schedules.json. Skills already had a place for triggers, so cron moves onto a command's frontmatter or bundle manifest. The JSON file is dropped; the daemon fires it.

confirm: true opts a triggered run into plan mode.