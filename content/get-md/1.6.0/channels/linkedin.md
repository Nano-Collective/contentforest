---
product: get-md
version: "1.6.0"
channel: linkedin
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 1753
distributed_at: "2026-07-09T19:07:15.784Z"
---

get-md v1.6.0 ships today. The library is no longer HTML-only: PDF, DOCX, and Markdown inputs join HTML and URLs, with auto-detection on the file extension or magic bytes (`%PDF` for PDF, the ZIP/`PK` signature for DOCX).

What's actually in the release:

- PDF ingestion via `convertToMarkdown` or the CLI. Text is reconstructed into real structure: paragraphs, headings, lists, with running headers and the `-- N of M --` page markers stripped. Title, author, and creation date flow into the frontmatter from the PDF info dictionary. Scanned PDFs return an empty result with a non-zero `inputLength`, which is the signal that OCR is needed rather than a successful extraction.

- DOCX ingestion, plus two new exports (`convertDocxToMarkdown`, `convertDocxToHtml`) for callers who want the DOCX path without going through the unified entry point. List type is resolved from `word/numbering.xml` rather than guessed, and nested tables no longer corrupt the outer table.

- Markdown input. A `.md` file with existing frontmatter is no longer doubled or has its real title clobbered. The optimization passes run without re-parsing the body as HTML.

- A top-to-bottom pass over the new multi-format surface closed a set of real bugs that surfaced during review: PDF body text no longer dropped by Readability, DOCX list ordering no longer flips at random, DOCX buffers now route through `convertToMarkdown` instead of throwing, and the test scripts now build before running.

592 tests passing, up from 528 at v1.5.0.

Install:

```
npm install @nanocollective/get-md@1.6.0
```

Built by the Nano Collective, a community collective building open-source AI tooling not for profit, but for the community.

Repo: https://github.com/Nano-Collective/get-md
Docs: https://docs.nanocollective.org/get-md/docs