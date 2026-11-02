---
kind: x-daily
date: "2026-11-02"
source: "json-up"
channel: x
angle: "Versions are not comparable"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 263
---

A migration version is an identifier, not a counter. Nothing meaningful sits between 1 and 2, so json-up runs the chain in the order you declared and rejects a chain that is not ascending. Skip a number, fine. Reorder two steps and you have changed the migration.
