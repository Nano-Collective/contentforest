---
product: prompt-scrub
version: "1.0.0"
channel: x
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 280
---

SecretDetector in prompt-scrub runs three layers: vendor-prefix patterns, a key-value heuristic, and a Shannon entropy gate at 4.5 bits/char. Missing a credential beats false positives, on purpose.

https://github.com/Nano-Collective/prompt-scrubber
