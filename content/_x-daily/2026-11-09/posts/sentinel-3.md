---
kind: x-daily
date: "2026-11-09"
source: "sentinel"
channel: x
angle: "Write the do-not-flag list"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 278
---

A pack that cannot say what not to flag gets a low-confidence finding on every line of idiomatic code.

Write a "Do not flag" section next to your true and false positive examples. Sentinel (alpha) reads the pack body as the audit prompt, so that list is what removes the noise.
