---
kind: x-daily
date: "2026-10-26"
source: "prompt-scrub"
channel: x
angle: "Stable bytes beat a faster prompt"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 223
---

A scrubber that reshuffles on every call defeats prompt caching. prompt-scrub treats that as the bug: same session and input, byte-identical output every time, and `inspect --hash` prints the SHA-256 of exactly those bytes.
