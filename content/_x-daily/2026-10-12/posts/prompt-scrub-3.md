---
kind: x-daily
date: "2026-10-12"
source: "prompt-scrub"
channel: x
angle: "A filtered run never goes quiet"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 280
---

A prompt with PII at 0.85 and one with nothing in it. With prompt-scrub scrub --min-confidence 0.9, both look identical, and the first is now a leak. Under-redaction is the dangerous direction, so a filtered run always prints what the threshold dropped, even when nothing survived