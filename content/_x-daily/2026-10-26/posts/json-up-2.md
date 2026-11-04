---
kind: x-daily
date: "2026-10-26"
source: "json-up"
channel: x
angle: "Async is opt-in, not a trapdoor"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 234
---

A Promise nobody awaits is a cost every caller pays for. json-up keeps the sync path first: createMigrations() gives you a synchronous chain, and createAsyncMigrations() is the deliberate opt-in when a migration actually has to await.
