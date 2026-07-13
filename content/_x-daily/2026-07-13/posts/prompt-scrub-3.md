---
kind: x-daily
date: "2026-07-13"
source: "prompt-scrub"
channel: x
angle: "Determinism for prompt caching"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 197
---

1 byte off, and the cache misses. prompt-scrub's scrub() is byte-stable per session, so placeholder order stays fixed and prompt caches stay hot. inspect --hash prints the SHA-256 so you can check.
