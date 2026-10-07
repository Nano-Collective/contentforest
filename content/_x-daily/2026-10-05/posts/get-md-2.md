---
kind: x-daily
date: "2026-10-05"
source: "get-md"
channel: x
angle: "useLLM without --block reads the local reader-lm"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 180
---

Your markdown converter shouldn't phone home to read a PDF. `get-md` ships a local reader-lm, so `useLLM` without `--block` runs in-process. The network is opt-in, not the default.