---
kind: x-daily
date: "2026-11-09"
source: "json-up"
channel: x
angle: "Three errors, three meanings"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 278
---

Your migration threw. You don't know where to look.

Catch json-up's three errors separately in `migrate()`: `ValidationError`, output missed that version's schema. `MigrationError`, your `up` threw. `VersionError`, bad config.

The fix is the transform, the data, or the setup.
