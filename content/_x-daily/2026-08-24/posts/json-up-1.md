---
kind: x-daily
date: "2026-08-24"
source: "json-up"
channel: x
angle: "JSON migrations should live in one file"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 226
---

Most "JSON migrations" are scattered `if (old.field)` guards across the codebase, with no record of which shape shipped when. json-up keeps every step in one versioned file: one place to read the history, one place to bump it.
