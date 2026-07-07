---
kind: x-daily
date: "2026-07-06"
source: "get-md"
channel: x
angle: "HTML-to-MD for code blocks and tables"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 257
---

Your HTML-to-MD converter just mangled a nested code block inside a table cell, and your LLM is hallucinating around the wreckage. get-md's Turndown path is tuned for LLM input, with an optional local ReaderLM-v2 pass for the structures a regex can't reach.