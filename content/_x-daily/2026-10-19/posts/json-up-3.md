---
kind: x-daily
date: "2026-10-19"
source: "json-up"
channel: x
angle: "schema-lives-next-to-up"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 222
---

A chain that validates only at the end makes every step look guilty. json-up pairs each up() with its own Zod schema and validates at that version. ValidationError.version points at the step, not two migrations downstream.
