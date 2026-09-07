---
kind: x-daily
date: "2026-09-07"
source: "prompt-scrub"
channel: x
angle: "rule-packs-are-npm-packages"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 261
---

A custom detector should install like any other dep, not through a plugin loader. prompt-scrub rule packs are plain npm packages: three export shapes (default array, named `detectors`, or `default.detectors`), resolved by Node like everything else in your tree.