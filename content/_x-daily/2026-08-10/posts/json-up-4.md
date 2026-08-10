---
kind: x-daily
date: "2026-08-10"
source: "json-up"
channel: x
angle: "Errors carry the version they failed at"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 232
---

Your catch knows the migration broke, not which step. json-up tags ValidationError, MigrationError, VersionError with a version, so the log points at the step. MigrationError adds a typed cause, ValidationError the Zod issues array.