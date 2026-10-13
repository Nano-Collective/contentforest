---
kind: x-daily
date: "2026-10-12"
source: "prompt-scrub"
channel: x
angle: "Every finding carries a confidence and a method"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 264
---

A detector that hides its misses can lose a secret. prompt-scrub scores every finding 0.0-1.0 and names the rule that fired, then filters on `minConfidence` before collision resolution runs, so a discarded span never masks the higher-score one sitting inside it.
