---
kind: x-daily
date: "2026-07-27"
source: "json-up"
channel: x
angle: "Three error types for migration failures"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 271
distributed_at: "2026-08-06T13:41:39.396Z"
---

"migration failed" in your logs tells you nothing. json-up throws ValidationError, MigrationError, VersionError - ValidationError carries the version and Zod issue path, so the log reads `settings.theme: invalid_enum_value`. The difference between fixing it and guessing.