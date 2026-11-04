---
kind: x-daily
date: "2026-11-02"
source: "get-md"
channel: x
angle: "Why the batch order lies"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 240
---

A thousand URLs shouldn't mean a thousand results in memory.

get-md's `convertBatch` yields each URL as it completes, not in input order, and never buffers more than the in-flight worker count. The batch size sets the work, not the memory.
