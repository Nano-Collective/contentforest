---
kind: x-daily
date: "2026-11-09"
source: "json-up"
channel: x
angle: "The version lives in the data"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 280
---

Your JSON's version is a field inside it, not a filename or a sidecar. json-up reads `_version` from the data, runs every migration above that number, writes it back each step.

That field is also where the chain starts: each `up` gets data typed by the previous version's schema.
