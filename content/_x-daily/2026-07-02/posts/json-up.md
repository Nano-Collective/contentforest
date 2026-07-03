---
kind: x-daily
date: "2026-07-02"
source: "json-up"
channel: x
angle: "Scattered if-checks for old formats"
generated_at: "2026-07-02T09:47:54.295Z"
model: "minimax-m3"
char_count: 272
distributed_at: "2026-07-03T13:41:44.726Z"
---

Every JSON store collects this rot: `if (data.version === 1)` checks scattered across files, formats you forgot existed, a single bad shape silently breaking users. json-up gives you declared migrations with Zod-validated `up` functions and one `_version` source of truth.