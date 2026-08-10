---
kind: x-daily
date: "2026-08-10"
source: "get-md"
channel: x
angle: "Stdin type detection by content"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 268
---

Pipe a file with no useful extension into get-md and it reads the bytes, not the name. `%PDF` on stdin lands it on the PDF branch, anything else falls through to HTML, so a chained shell command becomes Markdown without renaming anything. The filename is the fallback.