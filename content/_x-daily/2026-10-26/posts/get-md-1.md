---
kind: x-daily
date: "2026-10-26"
source: "get-md"
channel: x
angle: "Chunks carry their heading trail"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 276
---

A RAG answer that misses the point gets blamed on the model. Often the chunk lost its context. `get-md`'s chunkMarkdown splits at heading boundaries and prepends the heading trail (Docs, Setup, Install) to every chunk. Set overlap and an answer straddling a boundary surfaces.
