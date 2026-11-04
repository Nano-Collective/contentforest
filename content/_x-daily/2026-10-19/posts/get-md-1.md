---
kind: x-daily
date: "2026-10-19"
source: "get-md"
channel: x
angle: "buffer-routed-by-magic-bytes"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 253
---

A PDF renamed to .log or a DOCX with no extension at all shouldn't silently read as garbage. `get-md` sniffs %PDF and PK on the Buffer, so the filename and Content-Type don't get a vote. An unrelated binary throws a clear error instead of being misread.