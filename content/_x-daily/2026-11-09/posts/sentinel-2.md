---
kind: x-daily
date: "2026-11-09"
source: "sentinel"
channel: x
angle: "Never file the same issue twice"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 262
---

The same finding can change severity between runs and still be the same issue. Sentinel (alpha) dedups on a content hash of the rule pack and the file only. The test a field has to pass: will it be identical on the next run? A model never repeats itself exactly.
