---
product: get-md
version: "1.7.0"
channel: x
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 251
---

In get-md v1.6.0, validateMermaid flagged every labelled diagram as broken syntax. Root cause: DOMPurify (bundled with Mermaid) needs a DOM, and plain Node doesn't ship one. Fixed in 1.7.0.

https://github.com/Nano-Collective/get-md

#mermaid #nodejs