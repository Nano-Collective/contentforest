---
kind: x-daily
date: "2026-10-05"
source: "get-md"
channel: x
angle: "PDF and DOCX are routed by magic bytes"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 235
---

You shouldn't have to tell a converter what it's about to read. Pass `get-md` a `.pdf` or `.docx` and it picks the right pipeline from the file itself, no `--type` flag, no preset. PDF in stdin works the same way via the `%PDF` header.