---
kind: x-daily
date: "2026-06-23"
source: "json-up"
channel: x
angle: "Use your own field name for the version key"
generated_at: "2026-06-23T04:19:20.790Z"
model: "minimax-m3"
char_count: 188
distributed_at: "2026-06-23T13:43:22.071Z"
---

migrate() reads and writes _version by default, but the `key` option lets you point it at any field name (schemaVersion, revision, v) so the version lives where your data already keeps it. https://github.com/Nano-Collective/json-up