---
kind: x-daily
date: "2026-07-27"
source: "get-md"
channel: x
angle: "CLI stdin detects the file type"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 268
---

A PDF through a converter usually means a flag, or a per-format branch in your script. `cat doc.pdf | getmd` skips the negotiation. It sniffs the `%PDF` magic bytes and routes to the right extractor. One CLI for HTML, PDF, DOCX, Markdown. Less branching in the script.