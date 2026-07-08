---
product: get-md
version: "1.6.0"
channel: github-discussion
title: "get-md v1.6.0: PDF, DOCX, and Markdown ingestion alongside HTML"
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 5580
---

get-md v1.6.0 is out. The library is no longer HTML-only: PDF, DOCX, and Markdown inputs join HTML and URLs, with auto-detection on the file extension or magic bytes. Behind that headline is a launch-hardening pass over the whole multi-format surface that closes a set of real bugs surfaced during review.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## What changed

`convertToMarkdown` and the CLI now accept four input formats: HTML strings, URLs, PDF, DOCX, and Markdown files. Pass a `Buffer` or a `ContentSource` and get-md routes it to the right extractor automatically. The CLI detects format from the file extension, and for stdin it inspects the `%PDF` magic bytes directly.

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

// PDF
const pdf = await convertToMarkdown(pdfBuffer);
console.log(pdf.markdown);

// DOCX
const docx = await convertToMarkdown(docxBuffer);

// Markdown (skips HTML parsing, runs optimization passes only)
const md = await convertToMarkdown("# Heading\n\nAlready markdown.");
```

## PDF ingestion

Pass a PDF `Buffer` (auto-detected via the `%PDF` magic bytes) or point the CLI at a `.pdf` file or URL. Text is reconstructed into real structure: wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, `•` and numbered lines become lists with wrapped continuations folded in, and repeated running headers and footers are dropped.

Title, author, and creation date are pulled from the PDF info dictionary into the frontmatter, alongside the computed `wordCount` and `readingTime`. The `-- N of M --` page markers that `pdf-parse` emits by default are stripped before output. Readability is disabled for PDF input so body text is never dropped as boilerplate (a class of bug that was reachable in earlier code).

Scanned or text-less PDFs return an empty result with a non-zero `inputLength`, which is the signal that OCR is needed rather than a successful extraction. The extractor is powered by `pdf-parse`.

## DOCX ingestion

Pass a DOCX `Buffer` (auto-detected via the ZIP/`PK` magic bytes) or point the CLI at a `.docx` file or URL. Two new exports are available for direct use:

```typescript
import {
  convertDocxToMarkdown,
  convertDocxToHtml,
} from "@nanocollective/get-md";

const md = convertDocxToMarkdown(buffer, { /* options */ });
const html = convertDocxToHtml(buffer);
```

Supported structure: headings, bold/italic/underline/strikethrough, tables, and ordered/unordered lists. List type is resolved from `word/numbering.xml`, not guessed from `numId` parity, which previously caused ordered lists to flip to unordered at random. Nested tables no longer corrupt the outer table (the traversal now uses direct children). Decompression is capped at 100 MB, and corrupt, encrypted, or `document.xml`-less archives raise clear errors. The extractor is powered by `node-stream-zip`.

## Markdown input

`.md` and `.markdown` files (or `inputType: "markdown"`, or a `ContentSource` with `type: "markdown"`) skip HTML parsing entirely and run only the optimization passes: metadata, frontmatter, and structure normalization.

Existing frontmatter is preserved: your `title` and `author` are kept, and only the computed `wordCount` and `readingTime` are appended. Earlier code could produce a doubled frontmatter block or clobber the real title when a `.md` file already had YAML at the top. That path is fixed. The `--no-links`, `--no-images`, and `--no-tables` filters are honored on Markdown input as well.

## Bug fixes from the launch review

The multi-format surface got a top-to-bottom pass before this release shipped. Highlights:

- **PDF no longer loses body text.** Readability was running on PDF-derived HTML and could strip content it scored as boilerplate. It is now disabled for PDF input, matching the DOCX behaviour.
- **PDF page-marker noise removed.** The `-- N of M --` separators no longer leak into the output.
- **PDF metadata and structure.** Title, author, and date flow into the frontmatter. Extracted text is reconstructed into headings, paragraphs, and lists instead of one flat blob.
- **DOCX list types are correct.** Ordered vs. unordered comes from `word/numbering.xml`, not from a `numId`-parity guess.
- **DOCX tables.** Nested tables no longer corrupt the outer table. Decompression is bounded and archive errors are clear.
- **DOCX buffers via `convertToMarkdown`.** A DOCX `Buffer` now converts through `convertToMarkdown` (via PK/zip detection), matching the PDF buffer path instead of throwing.
- **Markdown input.** A `.md` file that already had frontmatter no longer produces a doubled block or clobbers the real title. `--no-links`, `--no-images`, and `--no-tables` are honored for Markdown input.
- **Build before test.** `scripts/test.sh` and the badges workflow now build first, since the CLI end-to-end tests spawn the compiled `bin/get-md.js` (stale `dist/` would skew results).

## CLI

The CLI advertises all four formats and detects the input type from the extension, or from the `%PDF` magic bytes on stdin:

```bash
getmd handbook.pdf -o handbook.md
getmd contract.docx -o contract.md
getmd notes.md -o cleaned.md
getmd https://example.com/article -o article.md
```

## Documentation

The Conversion API page covers PDF and DOCX buffers, binary auto-detection, `inputType`, the `convertDocx*` exports, and Markdown input. The CLI reference documents format detection and the DOCX/`.md` input paths. Getting Started and Quick Start show PDF, DOCX, and Markdown examples alongside the HTML path.

## Tests

592 passing (up from 528 at 1.5.0). New coverage for PDF extraction, page-marker stripping, info-dict metadata, and structure reconstruction; DOCX buffer routing, `numbering.xml` list resolution, and corrupt-archive errors; Markdown-input frontmatter preservation and content filtering; and real DOCX and PDF CLI end-to-end runs.

## Upgrading

```bash
npm install @nanocollective/get-md@1.6.0
```

Or:

```bash
pnpm add @nanocollective/get-md@1.6.0
```

Node.js 22 or later is required. No peer dependencies are required for the standard HTML/PDF/DOCX/Markdown paths.

If you hit any issues or want to discuss the new format support, open an issue or find us on [Discord](https://discord.gg/ktPDV6rekE).

Repo: https://github.com/Nano-Collective/get-md