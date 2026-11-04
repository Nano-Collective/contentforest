---
kind: x-daily
date: "2026-11-02"
source: "json-up"
channel: x
angle: "Schema is the migration"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 276
---

Most migration tools make you cast: the step returns `any` and you hope the shape holds. In json-up each migration names a Zod schema and the up function returns data matching it, so your state type changes as you migrate. Zod is a peer dep, so you audit the version you ship.
