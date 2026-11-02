---
kind: x-daily
date: "2026-11-02"
source: "sentinel"
channel: x
angle: "Only changed files, please"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 219
---

80 model calls a day: 20 repos, 4 packs each, run daily. That is the cost of a Sentinel (alpha) audit. With incremental: true, each pack reads only the files that changed since it last passed, instead of the whole repo.
