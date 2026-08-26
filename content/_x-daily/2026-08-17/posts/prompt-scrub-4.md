---
kind: x-daily
date: "2026-08-17"
source: "prompt-scrub"
channel: x
angle: "Off is the safe default for detectors"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 269
---

A sloppy detector is worse than no detector. prompt-scrub ships NameDetector and CodeTellDetector off by default: a false positive rewrites your code mid-flight, a missed detection just doesn't help. Opt in only when you know the false-positive cost on your own config.