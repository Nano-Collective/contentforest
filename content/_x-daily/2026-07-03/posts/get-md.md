---
kind: x-daily
date: "2026-07-03"
source: "get-md"
channel: x
angle: "Tail-only overlap with heading trail"
generated_at: "2026-07-03T04:06:21.656Z"
model: "minimax-m3"
char_count: 278
---

A RAG answer straddling a chunk boundary only surfaces if both halves make retrieval. Two chunkMarkdown defaults carry it: overlap reads the tail of the original previous chunk, not the carried one. Skip that and it compounds until it eats the chunk. Heading trail is prepended.