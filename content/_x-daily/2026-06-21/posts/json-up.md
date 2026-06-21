---
kind: x-daily
date: "2026-06-21"
source: "json-up"
channel: x
angle: "Three error types you can actually catch"
generated_at: "2026-06-21T05:17:17.389Z"
model: "minimax-m3"
char_count: 252
---

`migrate()` and `migrateAsync()` throw three distinct error types: `ValidationError` (output vs schema), `MigrationError` (your `up()` threw), `VersionError` (bad config). Branch on cause, not a generic catch. https://github.com/Nano-Collective/json-up
