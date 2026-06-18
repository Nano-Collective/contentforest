---
kind: x-daily
date: "2026-06-18"
source: "get-md"
channel: x
angle: "Chunk markdown for RAG ingestion"
generated_at: "2026-06-18T04:59:54.471Z"
model: "minimax-m3"
char_count: 237
---

get-md's chunkMarkdown splits at heading boundaries, keeps a heading trail on each chunk, and supports overlap so RAG answers that straddle a boundary still surface. The RAG half of the pipeline. https://github.com/Nano-Collective/get-md