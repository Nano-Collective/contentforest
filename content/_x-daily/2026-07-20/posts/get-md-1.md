---
kind: x-daily
date: "2026-07-20"
source: "get-md"
channel: x
angle: "PDF and DOCX go through the same CLI"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 231
distributed_at: "2026-07-22T11:48:58.579Z"
---

`getmd notes.md` isn't a no-op. While `.pdf`, `.docx`, and `.html` route to their extractors by extension, `.md` skips HTML parsing and still runs frontmatter + structure normalisation. Same CLI, four formats, no flags to remember.