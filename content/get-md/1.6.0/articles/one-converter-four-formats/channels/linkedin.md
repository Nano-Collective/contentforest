---
product: get-md
version: "1.6.0"
channel: linkedin
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 2410
---

A quick walk through the dispatch logic inside get-md v1.6.0's `convertToMarkdown`, for anyone curious how the same function entry point now handles HTML, URLs, PDF, DOCX, and Markdown without the caller threading format flags.

The discriminator is the runtime type of `input`:

- `Buffer.isBuffer(input)` runs the binary path. Two magic-byte checks against the leading bytes: `%PDF` (4 bytes) routes to the PDF extractor, `PK` (2 bytes) routes to the DOCX converter via a recursive call. Anything else throws a clear "unsupported binary format" error.
- `typeof input === "string"` runs the text path. URLs get fetched, and URLs ending in `.pdf` go through the same PDF path as a `Buffer` would (the URL fetcher returns a `Buffer` and the magic-byte dispatch takes over from there). DOCX URLs are not special-cased on the string branch, by design: fetch into a `Buffer` first.
- A `ContentSource` object is the typed "I know what I'm giving you" entry. `{ type: "markdown" }` routes to `convertMarkdownInput`; `{ type: "html" }` continues into the parser.

The interesting bit is the `forceExtractContentOff` flag. The PDF path sets it to `true` so that Readability is disabled before the synthetic HTML hits the parser. The DOCX path sets `extractContent: false` at the recursive call site in `converters/docx-converter.ts`. Both binary formats skip Readability because the entire document is the article body, and Readability's scoring will routinely drop short paragraphs, footnotes, and headers it can't recognise from a non-web source.

Why magic bytes on the buffer instead of a `format` option? Bytes are unambiguous. A buffer that opens with `%PDF` is a PDF. A `format: "pdf"` string could be wrong. The magic-byte check is the same code path callers would otherwise have to write correctly themselves, and it makes "pass me anything, I'll figure it out" a real claim.

The CLI does the same detection in a different shape: file extension for paths and URLs, then the same `%PDF` check on stdin (where there is no extension). The shape is consistent: bytes-or-extension-implied format, then route to the right path.

Read the full code walkthrough on GitHub.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions

Built by the Nano Collective, a community collective building open-source AI tooling not for profit, but for the community.
