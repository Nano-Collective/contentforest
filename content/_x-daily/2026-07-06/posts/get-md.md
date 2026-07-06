---
kind: x-daily
date: "2026-07-06"
source: "get-md"
channel: x
angle: "Sub-100ms HTML to Markdown"
generated_at: "2026-07-06T11:30:24.566Z"
model: "minimax-m3"
char_count: 260
---

Under 100ms. That is how long `get-md` takes to turn a fetched HTML page into clean Markdown, fast enough to call from inside a request handler instead of a batch job. Turndown plus Readability do the work; drop in a local ReaderLM-v2 path for the messy pages.
