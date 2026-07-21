---
kind: x-daily
date: "2026-07-13"
source: "get-md"
channel: x
angle: "Readability first, regex second"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 263
distributed_at: "2026-07-21T19:55:08.278Z"
---

Most HTML-to-markdown tools hand you the page chrome and let a regex clean it up after.

get-md runs Mozilla Readability first. The extraction layer throws the chrome out, then Turndown sees only the article. Clean at the content layer, not at the markdown layer.
