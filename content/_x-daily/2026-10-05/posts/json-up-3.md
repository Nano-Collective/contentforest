---
kind: x-daily
date: "2026-10-05"
source: "json-up"
channel: x
angle: "migrate walks version by version, not all at once"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 257
---

When your stored JSON drifts from its schema, guessing which version broke it is the slow part. json-up's migrate walks each version in order and throws at the exact step where the contract no longer matches, so the diff is one version, not the whole chain.