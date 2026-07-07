---
kind: x-daily
date: "2026-07-06"
source: "json-up"
channel: x
angle: "Migrations not if statements"
generated_at: "2026-07-06T11:30:24.566Z"
model: "minimax-m3"
char_count: 255
distributed_at: "2026-07-07T19:01:04.891Z"
---

A stack of `if (oldField) newField = oldField` checks is a timebomb: the schema you did not predict is the one that silently misreads. `json-up` puts the version number on the data and validates each step with Zod, so a bad shape stops the migration cold.