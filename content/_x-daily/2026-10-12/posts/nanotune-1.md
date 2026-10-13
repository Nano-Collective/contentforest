---
kind: x-daily
date: "2026-10-12"
source: "nanotune"
channel: x
angle: "Benchmark rejects malformed flags outright"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 226
---

A typo in a CLI flag should be loud, not silent. nanotune benchmark rejects --temperature, --seed, and --samples when they can't be parsed, so --samples 5x fails naming the flag instead of running with a default you never set.
