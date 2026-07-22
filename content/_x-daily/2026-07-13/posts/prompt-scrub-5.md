---
kind: x-daily
date: "2026-07-13"
source: "prompt-scrub"
channel: x
angle: "Detectors ship as npm packages"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 241
distributed_at: "2026-07-22T11:46:26.164Z"
---

The detector set shouldn't grow by patching the engine. prompt-scrub ships detectors as npm rule packs, so a domain-specific check is a package that exports a Detector array, not a fork. The principle: the core stays small, the rules travel.