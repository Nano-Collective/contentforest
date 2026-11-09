---
kind: x-daily
date: "2026-11-09"
source: "json-up"
channel: x
angle: "Why every step carries a schema"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 271
---

A migration step without a schema is a transform function that hopes.

json-up takes the other bet: every step declares the Zod schema its output must satisfy, and is checked against it. A step that drifts fails at that version, not later as a runtime bug in stored data.
