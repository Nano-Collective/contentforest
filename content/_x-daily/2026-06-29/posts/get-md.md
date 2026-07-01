---
kind: x-daily
date: "2026-06-29"
source: "get-md"
channel: x
angle: "Why get-md ships two conversion engines on purpose"
generated_at: "2026-06-29T04:57:52.338Z"
model: "minimax-m3"
char_count: 275
distributed_at: "2026-07-01T14:16:32.702Z"
---

Most HTML→MD libs ship one engine and call LLM an "optional upgrade". `get-md` ships Turndown and ReaderLM-v2 as peers because complex docs want semantic understanding, batch jobs want sub-100ms determinism. The right tool depends on the work, not on whether an LLM exists.