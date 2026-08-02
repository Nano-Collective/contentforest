---
kind: x-daily
date: "2026-07-27"
source: "sentinel"
channel: x
angle: "Close as false-positive and it never refiles"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 196
---

Dismiss a finding once and Sentinel never refiles it. The audit reads the false-positive label and drops it from future runs, so the noise you triaged on Tuesday doesn't reopen itself next Monday.