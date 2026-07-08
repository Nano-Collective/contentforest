---
product: get-md
version: "1.6.0"
channel: reddit
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 4989
---

We've just shipped get-md v1.6.0, and the headline change is that get-md is no longer HTML-only. PDF, DOCX, and Markdown inputs now join HTML strings and URLs, with format auto-detection on the file extension or the magic bytes (`%PDF` for PDF, the ZIP/`PK` signature for DOCX).

Here's what's actually in the release.

## PDF, DOCX, and Markdown inputs

`convertToMarkdown` now accepts a `Buffer` or a `ContentSource` and routes it to the right extractor automatically. The CLI does the same: pass a `.pdf`, `.docx`, or `.md` file and it figures out the format from the extension. For stdin, it inspects the `%PDF` magic bytes directly.

On the PDF side, text is reconstructed into real structure rather than one flat blob. Wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, and bulleted or numbered lines become lists (with wrapped continuations folded in). Repeated running headers and footers are dropped. Title, author, and creation date flow into the frontmatter from the PDF info dictionary. The `-- N of M --` page markers that `pdf-parse` emits by default are stripped. Readability is disabled for PDF input so body text is never silently dropped as boilerplate. Scanned or text-less PDFs return an empty result with a non-zero `inputLength`, which is the signal that OCR is needed rather than a successful extraction.

On the DOCX side, list type (ordered vs. unordered) is now resolved from `word/numbering.xml` rather than guessed from `numId` parity. That guess was the source of a class of bug where ordered lists would flip to unordered at random. Nested tables no longer corrupt the outer table (we use direct-children traversal now). Decompression is capped at 100 MB, and corrupt, encrypted, or `document.xml`-less archives raise clear errors. Two new exports are available for callers who want the DOCX path directly: `convertDocxToMarkdown(buffer, options)` and `convertDocxToHtml(buffer)`.

On the Markdown input side, `.md` and `.markdown` files (or `inputType: "markdown"`) skip HTML parsing entirely and run only the optimization passes: metadata, frontmatter, and structure normalization. A subtle bug here was that an existing YAML frontmatter block on a `.md` file could get doubled, or its real `title` could get clobbered by the computed frontmatter. That's fixed; existing `title` and `author` are preserved, and only `wordCount` and `readingTime` are appended. The `--no-links`, `--no-images`, and `--no-tables` filters are honored on Markdown input as well.

## Bug fixes from the launch review

The multi-format surface got a top-to-bottom pass before this release shipped. We closed a real set of bugs that surfaced during review:

- PDF no longer loses body text (Readability was running on PDF-derived HTML and could drop content it scored as boilerplate; it's now disabled for PDF input, matching DOCX).
- PDF page-marker noise is removed (`-- N of M --` separators no longer leak into the output).
- PDF metadata and structure (title/author/date flow into the frontmatter, and extracted text is reconstructed into headings/paragraphs/lists instead of one flat blob).
- DOCX list types are correct (resolved from `word/numbering.xml` instead of a `numId`-parity guess).
- DOCX tables (nested tables no longer corrupt the outer table; decompression is bounded and archive errors are clear).
- DOCX buffers via `convertToMarkdown` (a DOCX `Buffer` now converts through `convertToMarkdown` via PK/zip detection, matching the PDF buffer path instead of throwing).
- Markdown input (a `.md` file that already had frontmatter no longer produces a doubled block or clobbers the real title; `--no-links`/`--no-images`/`--no-tables` are honored for Markdown input).
- Build before test (`scripts/test.sh` and the badges workflow now build first, since the CLI end-to-end tests spawn the compiled `bin/get-md.js`).

## Tests and docs

592 tests passing, up from 528 at v1.5.0. New coverage covers PDF extraction, page-marker stripping, info-dict metadata, and structure reconstruction; DOCX buffer routing, `numbering.xml` list resolution, and corrupt-archive errors; Markdown-input frontmatter preservation and content filtering; and real DOCX and PDF CLI end-to-end runs.

The Conversion API page now covers PDF and DOCX buffers, binary auto-detection, `inputType`, the `convertDocx*` exports, and Markdown input. The CLI reference documents format detection and the DOCX and `.md` input paths. Getting Started and Quick Start show PDF, DOCX, and Markdown examples alongside the HTML path.

## Install

```
npm install @nanocollective/get-md@1.6.0
```

Node.js 22 or later is required. No peer dependencies are required for the standard HTML, PDF, DOCX, or Markdown paths.

If you've been holding off on get-md because of the HTML-only surface, this is the release to revisit. And if you've been hitting one of the bugs above on a pre-release branch, this should clear it.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions