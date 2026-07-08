---
product: get-md
version: "1.6.0"
channel: reddit
generated_at: "2026-07-08T15:55:41.290Z"
model: "minimax-m3"
char_count: 0
---

We shipped get-md v1.6.0 today. The big change is that get-md is no longer HTML-only. You can now pass a PDF, a DOCX, or a Markdown file to convertToMarkdown and it routes to the right extractor automatically. The CLI detects the format from the file extension, or from the PDF magic bytes if you pipe a buffer in on stdin.

**PDF** is the one we spent the most time on. Wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, list markers are recognised, and repeated running headers and footers are dropped. Title, author, and creation date flow from the PDF info dictionary into the frontmatter. Readability is now disabled for PDF input (it was stripping body text it scored as boilerplate, which is a quiet but bad failure mode). The -- N of M -- page markers from pdf-parse are stripped. Scanned or text-less PDFs return an empty result with a non-zero inputLength, which is the signal you need to reach for OCR.

**DOCX** support lives in the same call site. Two new exports, convertDocxToMarkdown and convertDocxToHtml, cover direct use. The list-type bug that made ordered lists render as bullets is fixed: it now reads word/numbering.xml rather than guessing from numId parity, which is what was flipping them at random. Nested tables no longer corrupt the outer table. Decompression is capped at 100 MB and corrupt, encrypted, or document.xml-less archives raise clear errors.

**Markdown input** is the smallest change but it was missing in a way that bit people. .md and .markdown files now skip HTML parsing and run only the optimisation passes. Existing frontmatter is preserved (your real title and author are kept, only wordCount and readingTime are appended, so no more stacked second frontmatter block). The --no-links, --no-images, and --no-tables flags are honoured for .md input.

The **launch-hardening pass** is the part of this release we are quietly most happy about. PDF body-text loss (Readability), DOCX list-type guessing, DOCX buffer routing, and a test-script ordering bug (stale dist was skewing CLI end-to-end results) are all fixed. Multi-format extraction has a "mostly works" failure mode that is worse than "does not work", because you get a document but a paragraph is missing or a list is demoted. The fixes here are mostly about making the multi-format path boring in the good sense.

**Documentation** now covers the new paths on the Conversion API page and the CLI reference, and the Getting Started and Quick Start pages show PDF, DOCX, and Markdown examples alongside the HTML and URL examples.

**Tests**: 592 passing, up from 528 at v1.5.0. New coverage for PDF extraction, page-marker stripping, info-dict metadata, and structure reconstruction; DOCX buffer routing, numbering.xml list resolution, and corrupt-archive errors; Markdown-input frontmatter preservation and content filtering; and real DOCX and PDF CLI end-to-end.

If you are already on v1.5.x, this is a drop-in. The existing convertToMarkdown(htmlOrUrl) call site is unchanged. New call sites take a Buffer or a ContentSource and let the converter route by magic bytes or extension.

Repo: https://github.com/Nano-Collective/get-md
