---
kind: x-daily
date: "2026-08-10"
source: "json-up"
channel: x
angle: "Zod schema gates the migration"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 278
---

The migration runs, the next schema rejects the output, and the stored JSON is silently trust-me-broken. json-up runs Zod against every up() and throws ValidationError with issues pointing at the exact path, so the failing field is the message - not a generic migration failed.
