---
kind: x-daily
date: "2026-07-06"
source: "json-up"
channel: x
angle: "Three named error types"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 213
distributed_at: "2026-07-08T12:57:56.502Z"
---

Most migration libs throw a generic Error and leave you parsing the message. json-up throws three named types: VersionError, MigrationError, ValidationError. You know what actually went wrong without guessing.