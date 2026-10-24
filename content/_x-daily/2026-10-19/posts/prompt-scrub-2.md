---
kind: x-daily
date: "2026-10-19"
source: "prompt-scrub"
channel: x
angle: "duplicate-values-reuse-the-placeholder"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 275
---

Two john@example.com in a long session usually come back as Email_1 and Email_2. prompt-scrub does not. It loads the existing mapping for the session ID and appends, so the same email stays Email_1 both times.

Placeholders stay one-to-one across the runs where they have to.
