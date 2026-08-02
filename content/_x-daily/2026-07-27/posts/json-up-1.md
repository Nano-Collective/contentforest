---
kind: x-daily
date: "2026-07-27"
source: "json-up"
channel: x
angle: "Version zero is a real state"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 233
---

Version 0 is a real state, not a missing field. In json-up, JSON without a version key reads as v0 - so legacy data runs every migration on first load. No special branch for the unversioned case, the upgrade path just starts at zero.
