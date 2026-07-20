---
kind: x-daily
date: "2026-07-20"
source: "get-md"
channel: x
angle: "Stdin from a piped PDF is treated as a PDF"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 233
---

Most CLIs guess wrong on stdin. get-md sniffs the first bytes: `%PDF` routes to the PDF extractor, anything else gets parsed as HTML. DOCX and Markdown still need a file path, so the autodetect surface is wider than the docs suggest.