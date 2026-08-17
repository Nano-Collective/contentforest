---
kind: x-daily
date: "2026-08-17"
source: "get-md"
channel: x
angle: "Batches stream, not buffer"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 231
---

Buffer the whole batch and you OOM before the last URL resolves. get-md's convertBatch yields as each page completes, not in input order, so a 1000-URL run streams to disk the moment it's ready. Memory stays flat at the worker cap.