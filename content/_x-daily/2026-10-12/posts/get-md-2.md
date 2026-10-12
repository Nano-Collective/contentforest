---
kind: x-daily
date: "2026-10-12"
source: "get-md"
channel: x
angle: "Chunks carry the heading trail for RAG context"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 242
---

A chunk that reads only "Run npm install" is a chunk that's lost at retrieval. get-md's chunkMarkdown tracks the heading trail and prepends `Docs > Setup > Install` by default, so a deep-section chunk still tells the model where it came from.
