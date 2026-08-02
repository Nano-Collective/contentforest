---
kind: x-daily
date: "2026-07-27"
source: "nanocoder"
channel: x
angle: "Tune profiles shrink the prompt for small models"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 240
---

A 1B model burns a quarter of its context window on the system prompt.

The nano tune profile shrinks nanocoder's prompt from ~500-700 tokens to 150-250, and drops find_files, list_directory, subagent delegation. Context freed for the code.