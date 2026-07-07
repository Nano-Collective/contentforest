---
kind: x-daily
date: "2026-07-07"
source: "json-up"
channel: x
angle: "Every migration's output is re-validated"
generated_at: "2026-07-07T04:14:58.542Z"
model: "minimax-m3"
char_count: 259
distributed_at: "2026-07-07T19:03:03.494Z"
---

Most JSON migration libraries trust whatever `up()` returns. `json-up` re-runs your Zod schema on every step's output, so a wrong type or missing key throws `ValidationError` with the version and the issues list. Silent shape drift is structurally impossible.
