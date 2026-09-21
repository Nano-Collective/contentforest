---
kind: x-daily
date: "2026-09-21"
source: "get-md"
channel: x
angle: "Markdown strings need input type"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 264
---

Your mermaid fence came back with backslashes in front of every backtick.

Not a render bug. get-md assumed your string was HTML and escaped the fences.

Pass `inputType: "markdown"` and they pass through. The CLI reads `.md` from the extension; the library can't.