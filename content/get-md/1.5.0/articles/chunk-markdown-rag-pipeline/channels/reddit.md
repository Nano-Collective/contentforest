---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m3"
char_count: 0
---

We shipped `chunkMarkdown` in get-md v1.5.0 as a RAG-ingestion helper. Here is the short version of how it works.

The pipeline is `convertToMarkdown` to grab a URL, then `chunkMarkdown` to split the resulting markdown into retrieval-friendly chunks. The chunker splits on blank-line boundaries (paragraphs, code fences, list items, headings as separate units). Blocks that are still too large for the token budget get split on sentence boundaries, then on character windows as a last resort.

The structural detail that matters for retrieval: when the packer hits a heading and the current chunk already has body content, it starts a fresh chunk before the heading. This means each chunk starts at a section boundary, and a nearest-neighbor vector search is more likely to surface a complete answer rather than a partial one.

Overlap works by reading the tail of each chunk (measured in tokens via `estimateTokens`, a simple `Math.ceil(text.length / 4)`) and prepending it to the next chunk. The carry is taken from the original chunk text to avoid runaway overlap accumulation.

`estimateTokens` is intentionally conservative. It rounds up so callers budgeting against a context window get headroom rather than a false reading. For exact billing you would use `tiktoken` or your model's own tokenizer, but for deciding whether and how to chunk, the heuristic is fast and needs no external call.

The `MarkdownChunk` return type gives you `content`, `estimatedTokens`, `headingPath`, `index`, and `total` per chunk. `headingPath` is especially useful for labelling chunks in a retrieval UI or filtering by document section.

If you have been stitching this together by hand, the new RAG helpers are worth a look: https://github.com/Nano-Collective/get-md
