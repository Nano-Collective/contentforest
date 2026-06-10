---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "Turning URLs into RAG-ready chunks with get-md's chunkMarkdown"
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m3"
char_count: 0
---

`chunkMarkdown` landed in get-md v1.5.0 as the RAG-ingestion counterpart to `convertToMarkdown`. The problem it solves: raw HTML-to-markdown output is one long string, which almost always exceeds a model's context window. Split badly and you lose paragraph coherence. Split too finely and you lose document structure. Here is how the algorithm works under the hood.

## Splitting on semantic boundaries

The function starts by stripping YAML frontmatter from the markdown input. Frontmatter belongs to the document as a whole, not to any individual chunk, so it does not eat into every chunk's token budget.

The remaining body is split on blank-line boundaries, which in practice means paragraphs, code fences, list items, and headings as separate units. Each unit is assigned a token count via the same `estimateTokens` chars/4 heuristic used throughout the package.

If a block exceeds `maxTokens`, `chunkMarkdown` recursively subdivides it:
1. First it tries splitting on sentence boundaries (the regex fires on period/exclamation/question mark followed by whitespace and a capital letter).
2. If the resulting pieces still do not fit, it falls back to a character window of `maxTokens * 4` characters, which maps back to approximately `maxTokens` tokens under the chars/4 heuristic.

The result is a flat list of blocks where no single block ever exceeds `maxTokens`.

## Heading-aware greedy pack

The blocks list is then packed into chunks using a greedy algorithm that respects document structure. As the packer walks the blocks, it accumulates them into the current chunk until adding the next block would exceed `maxTokens`. At that seam, it closes the current chunk and starts a new one.

The structural preference that sets this apart from a naive greedy pack is the heading check. When the packer encounters a heading block and the current chunk already has body content (non-heading blocks), it closes the current chunk before the heading even if there is technically room left. This means a section heading always starts a fresh chunk. RAG retrieval works by nearest-neighbor vector similarity, and a chunk that starts mid-section is harder to answer questions about than one that starts at a heading.

The one exception is heading-only chunks: if the current chunk is just a heading (for example, the first chunk after a section break where only the heading fits in the remaining budget), the packer keeps it with the next heading rather than orphan it.

## Overlap carries context across boundaries

Adjacent chunks have no shared content by default. With `overlap` set, `chunkMarkdown` reads the tail of the previous chunk (measured in tokens via the chars/4 heuristic) and prepends it to the next chunk. The carry is taken from the original text of the chunk, not from the version that already includes a prior carry, which prevents the overlap window from growing every time it propagates.

This means a question that falls partly in chunk N and partly in chunk N+1 surfaces in both results when the embedding is queried.

## The chars/4 heuristic and what it does not promise

`estimateTokens` divides `text.length` by 4 and rounds up. The CHARS_PER_TOKEN constant of 4 is calibrated for OpenAI/Anthropic-family tokenizers running on English prose. Code, JSON, and CJK text tokenise more densely (fewer characters per token). Long URLs and punctuation-heavy fragments tokenise more sparsely (more characters per token). The choice of 4 instead of, say, 3.5 is intentionally conservative: rounding up means the estimate is unlikely to undercount, and a caller budgeting against a context window gets headroom rather than a false sense of space.

For exact billing, callers should pass the text through `tiktoken` or the target model's own tokenizer. For deciding whether to chunk and how to size the chunks, the heuristic is fast, has no network dependency, and produces usable results on the English-heavy markdown that get-md produces.

The same estimate also appears on `ConversionStats.estimatedTokens` for every single-URL conversion, so the calling code has token context without any extra calls to the helper.

## A complete RAG ingestion pipeline

`chunkMarkdown` composes directly with `convertToMarkdown`:

```typescript
import { convertToMarkdown, chunkMarkdown } from '@nanocollective/get-md';

const { markdown } = await convertToMarkdown('https://example.com/long-article');
const chunks = chunkMarkdown(markdown, { maxTokens: 1500, overlap: 150 });

for (const chunk of chunks) {
  await embed(chunk.content); // your vector store of choice
}
```

The `MarkdownChunk` return type carries `content`, `estimatedTokens`, `headingPath`, `index`, and `total`. `headingPath` gives the full trail from root heading to the current section, which is useful for labelling chunks in a UI or filtering by section without re-parsing the markdown.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Repo: https://github.com/Nano-Collective/get-md
