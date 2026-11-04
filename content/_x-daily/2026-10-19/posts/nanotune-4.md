---
kind: x-daily
date: "2026-10-19"
source: "nanotune"
channel: x
angle: "three-fine-tune-types-for-three-failures"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 273
---

A low-rank adapter can hit a ceiling that isn't capacity. It runs out of direction room before it runs out of loss. Nanotune's `--fine-tune-type dora` keeps the rank low but splits magnitude from direction, so the adapter can scale without dragging the weight matrix along.