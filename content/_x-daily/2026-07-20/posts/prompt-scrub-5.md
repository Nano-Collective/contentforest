---
kind: x-daily
date: "2026-07-20"
source: "prompt-scrub"
channel: x
angle: "CodeTell detector is opt-in and no-op without terms"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 267
---

Generic identifiers like count or id would flood your session map with junk matches. prompt-scrub's CodeTellDetector is dormant by default for that reason. Pass --code-tell-terms with the names you treat as sensitive and it scrubs only those. One flag, your detector.