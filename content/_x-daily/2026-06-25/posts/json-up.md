---
kind: x-daily
date: "2026-06-25"
source: "json-up"
channel: x
angle: "Legacy data is treated as v0"
generated_at: "2026-06-25T14:05:50.027Z"
model: "minimax-m3"
char_count: 264
distributed_at: "2026-06-25T15:38:58.747Z"
---

Adopting a migration library? The worst part is the pre-step: special-casing old data with no version field at all. json-up treats missing `_version` as version 0, so legacy payloads run through the same `migrate()` call. https://github.com/Nano-Collective/json-up