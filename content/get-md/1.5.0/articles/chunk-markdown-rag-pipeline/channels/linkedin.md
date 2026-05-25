---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m2.7"
char_count: 0
---

A quick breakdown of how get-md v1.5.0's chunkMarkdown function works for RAG pipelines. The new export splits markdown into context-window-sized chunks using a heading-aware greedy pack, then lets you add overlap so chunk boundaries do not drop relevant context. `estimateTokens` provides a chars/4 heuristic so your pipeline can budget against a real context window without calling an external tokenizer.

The practical flow: `convertToMarkdown` gets you raw markdown, `chunkMarkdown` turns it into retrieval-ready chunks, and `MarkdownChunk` gives you content, estimated tokens, heading path, index, and total count per chunk. `headingPath` is useful for labelling or filtering by section.

If you are building RAG on top of crawled content, this is the missing piece between fetching a URL and loading it into your vector store. No proprietary format, no lock-in, just markdown chunks.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Repo: https://github.com/Nano-Collective/get-md
