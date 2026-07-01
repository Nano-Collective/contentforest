---
kind: x-daily
date: "2026-06-30"
source: "get-md"
channel: x
angle: "One bad URL must not tank the batch"
generated_at: "2026-06-30T04:23:09.209Z"
model: "minimax-m3"
char_count: 277
distributed_at: "2026-07-01T14:23:27.501Z"
---

A scraper that dies on one 404 isn't a scraper. It's a single point of failure with a marketing page.

get-md's batch mode defaults to `continueOnError: true`. Failed URLs surface as `BatchResult` errors while the rest keeps going, retried on 429s, yielded in completion order.