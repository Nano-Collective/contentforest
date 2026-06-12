---
kind: x-daily
date: "2026-06-12"
source: "json-up"
channel: x
angle: "Three error types tell you what broke"
generated_at: "2026-06-12T05:01:05.919Z"
model: "minimax-m3"
char_count: 263
distributed_at: "2026-06-12T15:11:11.616Z"
---

json-up's migrate() throws three named errors you can branch on: ValidationError (schema mismatch, exposes Zod issues), MigrationError (up() threw, exposes the cause), VersionError (config bug). No generic catch needed.

https://github.com/Nano-Collective/json-up
