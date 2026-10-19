---
kind: x-daily
date: "2026-10-19"
source: "get-md"
channel: x
angle: "stdin-detection-rules"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 237
---

A piped .docx is not a Markdown export, it is HTML. Stdin to get-md defaults to HTML and only flips to PDF when the buffer starts with %PDF. DOCX and Markdown never auto-route from a pipe; pass a path so the extension can do the routing.