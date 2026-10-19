---
kind: x-daily
date: "2026-10-19"
source: "nanocoder"
channel: x
angle: "image-attachments-path-handling"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 230
---

A dragged screenshot shouldn't dump `Screenshot\ 2026-06-21\ at\ 10.04.32.png` into your prompt. Nanocoder resolves pasted, dragged, or escaped paths at submit time to `[Image #N]`, so the model gets the picture, not the filename.
