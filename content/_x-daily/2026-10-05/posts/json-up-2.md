---
kind: x-daily
date: "2026-10-05"
source: "json-up"
channel: x
angle: "Three error types each name the cause"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 199
---

When a migration blows up, the stack trace is the wrong place to find out why. json-up throws ValidationError, MigrationError, and VersionError, so the catch site reads the cause instead of guessing.
