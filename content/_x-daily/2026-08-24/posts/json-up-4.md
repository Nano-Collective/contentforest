---
kind: x-daily
date: "2026-08-24"
source: "json-up"
channel: x
angle: "Validate outputs, not inputs"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 208
---

A migration that runs cleanly can still hand back garbage. json-up checks the up() result against the schema, not just the input, so a broken step fails where you can see it instead of three migrations later.
