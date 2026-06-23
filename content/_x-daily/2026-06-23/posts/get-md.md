---
kind: x-daily
date: "2026-06-23"
source: "get-md"
channel: x
angle: "Chunk markdown with heading context and overlap"
generated_at: "2026-06-23T04:19:20.790Z"
model: "minimax-m3"
char_count: 271
---

get-md's chunkMarkdown splits a converted doc at heading boundaries and prepends the heading trail to each chunk, so the model knows where it sits. An `overlap` option keeps answers that straddle a boundary in the retrieval set. https://github.com/Nano-Collective/get-md