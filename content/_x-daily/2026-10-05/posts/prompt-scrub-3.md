---
kind: x-daily
date: "2026-10-05"
source: "prompt-scrub"
channel: x
angle: "Stable placeholders round-trip across turns"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 217
---

A model that says "the key you mentioned earlier" needs to land on the same key on turn one and turn ten. prompt-scrub pins the placeholder format as a session-wide contract, so the same secret gets the same token every turn. The format is the round-trip, not a side effect.