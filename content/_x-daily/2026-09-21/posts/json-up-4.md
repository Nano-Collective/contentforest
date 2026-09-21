---
kind: x-daily
date: "2026-09-21"
source: "json-up"
channel: x
angle: "Fail loudly on bad ordering"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 241
---

A migration run with versions out of order or duplicated should not return partial state. Silent drift is worse than a stack trace. json-up throws VersionError on bad config so you find the bug on day one, not in production six months later.
