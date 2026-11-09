---
kind: x-daily
date: "2026-11-09"
source: "get-md"
channel: x
angle: "Chunk on meaning, not characters"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 279
---

Fixed-size chunks throw away what made the text answerable.

Embed the converted page through `chunkMarkdown(markdown, { maxTokens: 1000, overlap: 100 })` first. It splits on headings, paragraphs, sentences, characters, and prepends the heading trail so each chunk keeps context.
