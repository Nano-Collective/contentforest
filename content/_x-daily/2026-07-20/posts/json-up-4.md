---
kind: x-daily
date: "2026-07-20"
source: "json-up"
channel: x
angle: "Version 0 is the default for legacy JSON"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 270
---

Your oldest JSON file has no version field, and that file is the one that breaks first. json-up treats missing version as v0 by default, so every unversioned file in production runs through the same migration chain as a fresh one. No special-case branch for legacy data.