---
product: get-md
version: "1.6.0"
channel: github-discussion
title: "get-md v1.6.0: PDF, DOCX, and Markdown ingestion land alongside HTML"
generated_at: "2026-07-08T15:55:41.290Z"
model: "minimax-m3"
char_count: 0
---

get-md v1.6.0 is out. The headline is that `get-md` is no longer HTML-only. You can now pass a PDF, a DOCX, or a Markdown file (a `Buffer`, a path, or a URL) to `convertToMarkdown` and it routes to the right extractor automatically. Alongside the new ingest paths, we ran a launch-hardening pass over the whole multi-format surface and fixed a handful of things we would rather have caught before users did.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## What changed

### Multi-format input (PDF, DOCX, Markdown)

`convertToMarkdown` still takes HTML strings and URLs exactly as it did at v1.5.0, but it now also accepts more. Pass a `Buffer` or a `ContentSource` and the converter routes to the right extractor. The CLI detects the format from the file extension (or, for stdin, the PDF magic bytes).

- **PDF.** Pass a PDF `Buffer` (auto-detected via the `%PDF` magic bytes) or point the CLI at a `.pdf` file or URL. Text is reconstructed into real structure: wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, `•` and numbered lines become lists (with wrapped continuations folded in), and repeated running headers and footers are dropped. Title, author, and creation date are pulled from the PDF info dictionary and written into the frontmatter. Readability is disabled for PDFs so body text is never dropped, and `-- N of M --` page markers are stripped. Scanned or text-less PDFs return an empty result with a non-zero `inputLength`, which is a signal that OCR is needed. Powered by `pdf-parse`.
- **DOCX.** Pass a DOCX `Buffer` (auto-detected via the ZIP/`PK` magic bytes) or point the CLI at a `.docx` file or URL. Two new exports handle the format directly: `convertDocxToMarkdown(buffer, options)` and `convertDocxToHtml(buffer)`. The converter handles headings, bold, italic, underline, and strikethrough runs, tables, and ordered and unordered lists. List type is resolved from `word/numbering.xml` rather than guessed, which fixes a class of "ordered list rendered as bullet" bugs. Decompression is capped at 100 MB, and corrupt, encrypted, or `document.xml`-less archives raise clear errors. Powered by `node-stream-zip`.
- **Markdown input.** `.md` and `.markdown` files (or `inputType: "markdown"` / a `ContentSource` with `type: "markdown"`) skip HTML parsing entirely and run only the optimisation passes: metadata, frontmatter, and structure normalisation. Existing frontmatter is preserved. Your `title` and `author` are kept; only the computed `wordCount` and `readingTime` are appended, so there is no stacked second frontmatter block. `--no-links`, `--no-images`, and `--no-tables` are honoured for Markdown input.
- **CLI.** The tool's help text now advertises all four formats, and input type is auto-detected from the file extension (or the `%PDF` magic bytes on stdin).

### Launch hardening

A top-to-bottom review of the new multi-format surface before the public announcement:

- PDF no longer loses body text. Readability was running on PDF-derived HTML and could strip content it scored as boilerplate. It is now disabled for PDF input, matching DOCX.
- PDF page-marker noise removed. The `-- N of M --` page separators from `pdf-parse` no longer leak into the output.
- PDF metadata and structure. Title, author, and date now flow into the frontmatter, and extracted text is reconstructed into headings, paragraphs, and lists instead of one flat blob.
- DOCX list types are correct. Ordered vs. unordered is resolved from `word/numbering.xml` rather than from a `numId`-parity guess that flipped lists at random.
- DOCX tables. Nested tables no longer corrupt the outer table. Traversal is direct-children only, which matches how Word actually lays them out.
- DOCX buffers through `convertToMarkdown`. A DOCX `Buffer` now converts through `convertToMarkdown` (PK-zip detection), matching the PDF buffer path rather than throwing.
- Markdown input. Feeding a `.md` file that already has frontmatter no longer produces a doubled block or clobbers the real title. `--no-links`, `--no-images`, and `--no-tables` are now honoured.
- Build before test. `scripts/test.sh` and the badges workflow now build first, because the CLI end-to-end tests spawn the compiled `bin/get-md.js` and a stale `dist/` was skewing results.

## Why this release

`get-md` started as an HTML-to-Markdown converter. The batch, sitemap, and RAG helpers in v1.5.0 made it useful for ingestion pipelines, and the consistent feedback from those pipelines was that real-world content is not HTML. PDFs, DOCX exports, and existing Markdown notes are the other three inputs that show up the moment you point the tool at a real corpus. v1.6.0 makes the converter the multi-format one those pipelines already assumed it was, without changing the call site for the existing HTML path.

The hardening pass was a deliberate trade. Multi-format extraction is the kind of surface where "mostly works" is worse than "does not work", because the failure mode is silent: you get a document, but a paragraph is missing, or a list has been demoted to a bullet, or your frontmatter now has a second block. The fixes in this release are mostly about making the multi-format path boring, in the good sense.

## Documentation

The Conversion API page now covers PDF and DOCX buffers, binary auto-detection, `inputType`, the `convertDocx*` exports, and Markdown input. The CLI reference documents format detection and the DOCX and `.md` input paths. Getting Started and Quick Start now show PDF, DOCX, and Markdown examples alongside the HTML and URL examples.

## Tests

592 passing, up from 528 at v1.5.0. New coverage includes PDF extraction, page-marker stripping, info-dictionary metadata, and structure reconstruction; DOCX buffer routing, `numbering.xml` list resolution, and corrupt-archive errors; Markdown-input frontmatter preservation and content filtering; and real DOCX and PDF CLI end-to-end tests.

## Upgrading

```bash
npm install @nanocollective/get-md@1.6.0
```

or

```bash
pnpm add @nanocollective/get-md@1.6.0
```

The existing `convertToMarkdown(htmlOrUrl)` call site is unchanged. New call sites take a `Buffer` or a `ContentSource` and let the converter route by magic bytes or extension. If you were on v1.5.x with a `convertToMarkdown` that only handled HTML and URLs, v1.6.0 is a drop-in replacement with new options surfaced.

If you hit any issues or want to dig into the new paths, open an issue or find us on [Discord](https://discord.gg/ktPDV6rekE).

Repo: https://github.com/Nano-Collective/get-md
