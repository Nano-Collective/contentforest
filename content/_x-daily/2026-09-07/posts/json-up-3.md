---
kind: x-daily
date: "2026-09-07"
source: "json-up"
channel: x
angle: "builder-returns-a-typed-new-instance"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 229
---

Most migration chains hand you an `any` between steps. `json-up`'s builder doesn't: each `.add()` returns a new instance typed from the previous step's output. v1's schema becomes v2's input type. The chain carries the contract, in TS.
