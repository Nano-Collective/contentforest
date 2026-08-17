---
kind: x-daily
date: "2026-08-17"
source: "json-up"
channel: x
angle: "Validate at every step"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 279
---

A migration chain is only as trustworthy as the step you're on. Every up() output gets Zod-validated, so the fail surfaces at v3, not buried under v9.

That's what json-up does: its ValidationError carries the version it failed at, so the bug is localised, not piled at the end.
