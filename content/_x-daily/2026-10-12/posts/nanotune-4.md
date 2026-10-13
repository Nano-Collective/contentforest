---
kind: x-daily
date: "2026-10-12"
source: "nanotune"
channel: x
angle: "Samples N reports variance, not just pass rate"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 253
---

A pass rate from one draw hides the truth. nanotune `--samples 5` runs each test five times, records pass rate and variance per test, and passes on the majority. Each sample uses `seed + sample_index`, so runs stay reproducible while the samples differ.