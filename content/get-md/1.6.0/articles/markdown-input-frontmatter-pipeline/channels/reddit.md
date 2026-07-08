---
product: get-md
version: "1.6.0"
channel: reddit
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 8464
---

A short post about a fix we shipped in get-md v1.6.0 that turned out to matter more for real-world use than the headline suggested.

The headline for the release was "PDF, DOCX, and Markdown inputs join HTML and URLs." All true, all useful, and the PDF and DOCX work is the visible part. But the Markdown input path was quietly broken on real inputs in a way that we only noticed once we started feeding mixed corpora through the library, and the fix is what made the rest of the multi-format support usable in a RAG ingestion context.

## What the Markdown input path does

When you pass a `.md` or `.markdown` file (or `inputType: "markdown"` on a string, or a `ContentSource` tagged `type: "markdown"`), `convertToMarkdown` skips HTML parsing entirely and runs only the optimization passes: metadata extraction, content filtering (links, images, tables), structure post-processing, and frontmatter emission. No Readability, no Turndown, no cheerio. The Markdown is already Markdown; we just clean it up and tag it.

That part has worked in some form for a while. What broke was the frontmatter handling when the `.md` file already had its own YAML block.

## The bug class

If you had a file like this:

```markdown
---
title: "Quarterly Review"
author: "Sam Lee"
tags: [internal, q3]
---

# Quarterly Review

This document covers...
```

…and you ran it through the old Markdown input path, you'd get one of two outcomes depending on which heuristic fired first:

1. A second YAML block emitted on top of the first, with `wordCount`/`readingTime` and a freshly-extracted `title` (which might or might not match the user's). Downstream frontmatter parsers would either see the wrong block or fail to parse two blocks.
2. A single YAML block, but with the user's `title` overwritten by the body's first H1 (which usually matched but was not guaranteed to). The `author` got clobbered too, sometimes.

Both were bad. The second one was worse, because nothing in the output signalled that user-set values had been overwritten. A user who set `title: "Quarterly Review"` and had a body H1 of `# Q3 Review` would silently get `title: "Q3 Review"` in their corpus.

## How the fix works

The fix is structural. `convertMarkdownInput` splits the existing frontmatter off the body before anything else runs, parses the existing keys into a `Map`, and uses that map as the authoritative source for `title`, `author`, and `excerpt`. Body heuristics only fire when the frontmatter does not provide a value. The user's `title` and `author` always win.

For the reassembly, three cases:

- **Existing frontmatter, default `includeMeta: true`.** The original block is preserved as the raw inner lines, then `mergeMarkdownFrontmatter` appends `wordCount` and `readingTime` only if those keys are not already present. One block out, one block in. No second block.
- **No existing frontmatter, `includeMeta: true`.** A fresh YAML block is built from the extracted metadata: `title` from the first H1 (since there is no frontmatter to read), `excerpt` from the first long paragraph, `wordCount` and `readingTime` computed from the body.
- **`includeMeta: false`.** The body is emitted as-is. Any user frontmatter that was split off is dropped (the user's setting explicitly says "no metadata, including mine"). This matches the HTML path's behaviour.

The filter pass was also fixed. Pre-1.6.0, `--no-links`, `--no-images`, and `--no-tables` were silently ignored on the Markdown input path. That was wrong; the same flags now produce the same body shape whether the input is HTML, PDF, DOCX, or Markdown.

## Why this matters for RAG

The practical context is mixed-corpus ingestion. A typical setup has files pulled from different places: HTML pages exported from a CMS, PDFs from research portals, DOCX files from collaborators who refuse to use Markdown, and an existing folder of Markdown notes from a wiki or a previous ingestion run. The whole point of get-md v1.6.0 is that the same `convertToMarkdown(buffer, options)` call handles all four.

For a RAG pipeline, that means:

- **Uniform metadata contract.** `metadata.title`, `metadata.author`, `metadata.wordCount`, `metadata.readingTime` come back the same shape regardless of source format. The chunker downstream can index on `metadata.title` and `metadata.author` without caring whether the row came from a PDF or a `.md` file.
- **Uniform body shape.** The same `includeImages: false` filter drops images from all four formats the same way. A re-ingest that swaps an HTML source for a Markdown source doesn't change the chunker's behaviour.
- **No surprises on existing files.** A `.md` file that already had carefully-curated `title`/`author`/`tags` keeps them. The pipeline only adds computed stats on top.

That last point is what the bug was preventing. Before the fix, a corpus that was half Markdown already (a wiki, a notes folder, a previous pipeline's output) would lose its authored metadata on every re-ingest, or end up with double YAML blocks that parsers choked on. After the fix, the round trip is idempotent on authored fields and only adds computed stats.

## What the function does not do

Worth naming out loud, because the temptation is to assume "Markdown in, Markdown out, what could it be doing?":

- It does not run Readability. There is no HTML.
- It does not call the LLM converter. The `useLLM: true` option is a no-op on the Markdown path; the LLM is for HTML-to-Markdown where structure recovery is the hard part, and on Markdown input there is no structure to recover.
- It does not parse HTML embedded inside Markdown. A `.md` file containing `<table>...</table>` is left as-is by the `includeTables: false` filter, because the filter operates on GFM table syntax (`|...|`) and ignores HTML tables. If your corpus mixes GFM and HTML tables, pre-normalise before ingest.
- It does not split multi-document YAML streams. One file, one document. For chunking, use `chunkMarkdown` (added in v1.5.0) which splits at heading boundaries.
- It does not validate the user's frontmatter schema. If you set `tags: [foo, bar]` in list form, the list survives the round trip intact because the merge only appends computed stats and never touches keys it does not own. The list just gets `wordCount` and `readingTime` added below it.

## How to use it

Library:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
import { promises as fs } from "node:fs";

const buf = await fs.readFile("notes.md");
const result = await convertToMarkdown(buf, {
  inputType: "markdown", // optional; CLI sets this from the .md extension
  includeImages: false,
  includeLinks: false,
});

console.log(result.metadata.title); // from existing frontmatter or first H1
console.log(result.metadata.wordCount); // computed from body
console.log(result.markdown); // body with filters applied, no second YAML block
```

CLI:

```bash
getmd notes.md -o notes.clean.md
getmd notes.md --no-frontmatter -o notes.bare.md
getmd notes.md --no-links --no-images --no-tables -o notes.text-only.md
```

The CLI detects `.md` and `.markdown` extensions and routes them through the Markdown input path automatically. Stdin is treated as HTML unless it begins with the PDF magic bytes; pass a file path for Markdown.

## The launch review framing

The Markdown input path is not the most visible change in v1.6.0. PDF and DOCX support got the headlines. But the launch review caught the frontmatter corruption bug, the missing-content-filter bug, and a few related edge cases (malformed YAML openers, key collisions between authored and computed keys), and those were the bugs that mattered for the people running real ingestion pipelines. The fix is small in lines of code and big in "did anyone actually lose data on this version?"

That is the change worth explaining at length, because the headline phrasing ("skips HTML parsing, runs only the optimization passes") does not telegraph how much of the value is in "preserves your frontmatter" and "honours your filters."

If you have a mixed-format corpus and have been holding off on get-md because of the HTML-only surface, or because your existing `.md` files were getting mangled on re-ingest, this is the version to revisit. The repo has 592 passing tests covering the multi-format surface and the Markdown input path specifically.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions