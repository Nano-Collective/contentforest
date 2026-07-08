---
product: get-md
version: "1.6.0"
channel: linkedin
generated_at: "2026-07-08T15:55:41.290Z"
model: "minimax-m3"
char_count: 0
---

get-md v1.6.0 is out. The headline is that get-md is no longer HTML-only. You can now pass a PDF, a DOCX, or a Markdown file to convertToMarkdown and it routes to the right extractor automatically. CLI input type is auto-detected from the file extension or the PDF magic bytes on stdin.

PDFs get structure-aware extraction: wrapped lines reflow into paragraphs, ALL-CAPS lines become headings, list markers are recognised, and running headers and footers are dropped. Title, author, and creation date flow from the PDF info dictionary into the frontmatter. Scanned or text-less PDFs return an empty result with a non-zero inputLength, which is a clear signal that OCR is needed.

DOCX support is in the same call site. Two new exports, convertDocxToMarkdown and convertDocxToHtml, cover direct use. List type is resolved from word/numbering.xml rather than guessed, which fixes a class of "ordered list rendered as bullet" bugs. Decompression is capped at 100 MB and corrupt or encrypted archives raise clear errors.

Markdown input skips HTML parsing entirely and runs only the optimisation passes. Existing frontmatter is preserved, so your real title and author are kept and only wordCount and readingTime are appended. The CLI no longer drops --no-links, --no-images, or --no-tables for .md input.

We also ran a launch-hardening pass before the public announcement: PDF no longer loses body text (Readability is disabled for PDF input), page-marker noise is stripped, DOCX buffers route through convertToMarkdown, and the test scripts now build first so a stale dist cannot skew CLI end-to-end results.

592 tests, up from 528 at v1.5.0.

Full notes: https://github.com/Nano-Collective/get-md

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.
