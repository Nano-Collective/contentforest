---
kind: x-daily
date: "2026-10-12"
source: "json-up"
channel: x
angle: "migrate is sync, migrateAsync is the escape hatch"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 274
---

Most libs slap Promise.resolve() on their sync function and call it async. json-up does the opposite. migrateAsync() exists because up() bodies genuinely await (key generation, I/O), so it isn't a wrapper, it's the real path. The three error types stay identical either way.
