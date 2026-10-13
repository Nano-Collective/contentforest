---
kind: x-daily
date: "2026-10-12"
source: "json-up"
channel: x
angle: "VersionError means your config is wrong"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 260
---

A failed `migrate()` looks like a runtime bug. Often it is the config: empty array, unsorted, duplicate. `json-up` makes the split clean: VersionError = fix the migrations list, MigrationError = your `up()` threw, ValidationError = output did not match schema.
