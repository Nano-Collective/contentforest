---
kind: x-daily
date: "2026-07-05"
source: "get-md"
channel: x
angle: "RAG chunks lost their place"
generated_at: "2026-07-05T04:18:03.370Z"
model: "minimax-m3"
char_count: 251
distributed_at: "2026-07-06T12:32:27.570Z"
---

A RAG chunk surfaces as a match and the model can't tell you which section of which doc it came from. `get-md`'s `chunkMarkdown` prepends the heading trail (Docs / Setup / Install) to each chunk by default, so retrieval returns location with the text.