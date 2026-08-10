---
kind: x-daily
date: "2026-08-10"
source: "json-up"
channel: x
angle: "Untracked data is implicit version 0"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 264
---

Every migration library we've shipped wanted a one-time import script for pre-migration data. json-up skips the script: input without _version is treated as 0, and the first migrate() runs every step in order. The codebase picks up where it left off, by default.