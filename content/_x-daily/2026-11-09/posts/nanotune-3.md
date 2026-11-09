---
kind: x-daily
date: "2026-11-09"
source: "nanotune"
channel: x
angle: "Watch validation, not training"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 277
---

Training loss falling is not the same as learning.

In `nanotune train`, validation loss should track training loss. If validation climbs while training drops, you're memorizing, not learning. Stop earlier, cut iterations.

A final loss of 0.1-0.3 usually means a usable model.
