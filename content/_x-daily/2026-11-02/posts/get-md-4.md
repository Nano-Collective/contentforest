---
kind: x-daily
date: "2026-11-02"
source: "get-md"
channel: x
angle: "Read documents by content"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 267
---

The extension says .pdf. The Content-Type says text/html. One of them is lying, and your converter hands back garbage.

get-md routes by content: `%PDF` opens the PDF path, `PK` the DOCX one. The name is a hint, the bytes decide, so a mislabelled file still converts.
