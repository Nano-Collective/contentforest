---
product: get-md
version: "1.6.0"
channel: reddit
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 6812
---

Wrote up a code walkthrough of the dispatch logic inside get-md v1.6.0's `convertToMarkdown`, since I thought the implementation was interesting. The function takes a string, a `Buffer`, or a `ContentSource` and routes the input to the right extractor without the caller threading a format flag, and the way that worked out is a clean example of using runtime type and magic bytes as the discriminator.

## The shape of the function

The signature is `convertToMarkdown(input: string | Buffer | ContentSource, options?: MarkdownOptions)`. Three runtime types, three top-level branches in the function body:

- `Buffer.isBuffer(input)` runs the binary path. Two magic-byte checks against the leading bytes: `buffer.subarray(0, 4).toString() === "%PDF"` (4 bytes) routes to the PDF extractor in `src/extractors/pdf-extractor.ts`. `buffer.subarray(0, 2).toString("latin1") === "PK"` (2 bytes) routes to the DOCX converter in `src/converters/docx-converter.ts` via a recursive call. Anything else throws "Unsupported binary format: expected a PDF (%PDF) or DOCX (ZIP) buffer." Clear, fail-closed, no guessing.

- `typeof input === "string"` runs the text path. URLs are detected by `options?.isUrl || isValidUrl(input)`. URLs are fetched, and URLs ending in `.pdf` go through the same PDF path as a `Buffer` would: the URL fetcher returns a `Buffer`, the magic-byte dispatch takes over from there. DOCX URLs are not special-cased on the string branch, by design (the URL fetcher is text mode, which would corrupt the binary). The supported entry points for DOCX are `Buffer` and `ContentSource`. If you have a `.docx` URL, fetch it into a `Buffer` first.

- A `ContentSource` object is the typed "I know what I'm giving you" entry. `{ type: "markdown", content: "..." }` routes to `convertMarkdownInput` immediately. `{ type: "html", content: "..." }` is set as `contentSource` and continues into the parser.

## The `forceExtractContentOff` flag

The most consequential line in the dispatch is a single boolean hoisted to the top of the function. The PDF path sets it to `true`. Later, when `convertOptions` is built from `options`, the flag is checked and `extractContent: false` is forced:

```typescript
const convertOptions = { ...options, baseUrl };
if (forceExtractContentOff) {
  convertOptions.extractContent = false;
}
```

Readability (Mozilla's content extractor) is a useful tool for HTML: it scores nodes, picks the article body, and throws away nav, footers, and asides. For a buffer that was already a PDF or DOCX, the *entire document* is the article body, and Readability's scoring will routinely drop short paragraphs, footnotes, and headers it can't recognise from a non-web source. We saw this in the wild: a multi-page PDF's table of contents would get stripped, a chapter heading would be re-scored as a nav element, body text would vanish.

The DOCX path does the same thing, but at the `convertDocxToMarkdown` call site in `converters/docx-converter.ts`:

```typescript
return convertToMarkdown(html, {
  ...options,
  extractContent: false,
});
```

Both binary formats land in the same place: a parsed document, structure reconstructed, no Readability re-extraction. The HTML and URL branches leave the flag at its default of `false`, so Readability runs as it always has. The caller does not need to know this is happening.

## Why magic bytes on the buffer, not an option

You could express the same dispatch with a `format: "pdf" | "docx" | "html" | "markdown"` option. The code doesn't, and there are three reasons grounded in the implementation.

**Bytes are unambiguous.** A `Buffer` that opens with `%PDF` is a PDF; nothing else starts that way. A string `inputType: "pdf"` could be wrong, and a wrong `inputType` on a string input is a class of bug the magic-byte check makes impossible.

**Strings don't have magic bytes.** The URL branch uses the extension as a hint because that's the only signal available pre-fetch. The fetch is then treated as the same code path as a `Buffer` input: download, magic-byte-implied format, dispatch.

**Forced options leak into user code.** If `convertToMarkdown` required `format: "pdf" | "docx"`, the caller would have to know the format of their own buffer. The whole point of the 1.6.0 refactor was to remove that requirement. The `Buffer` path's magic-byte check is what makes "pass me anything, I'll figure it out" a real claim rather than marketing.

## The CLI's view of the same problem

The CLI in `src/cli.ts` has the same problem in a different shape, because the CLI takes a path or a URL, not a `Buffer`. The dispatcher there lives in `getInput`:

- File path with `.pdf` extension: read as a `Buffer`, mark `inputType: "pdf"`.
- URL with `.pdf` suffix (or `Content-Type: application/pdf`): fetch into a `Buffer`, mark `inputType: "pdf"`.
- Stdin (no extension hint): buffer the input, check the first 4 bytes for `%PDF`. If it matches, mark `inputType: "pdf"`. Otherwise, treat as text HTML.

The shape is the same: bytes-or-extension-implied format, then route to the right path. The CLI then calls into `convertToMarkdown` with the buffer, and the dispatch in `src/index.ts` does the same magic-byte check that confirmed the file's identity in the CLI. Redundant on the happy path, defensive on the unhappy path (a `.pdf` extension on a non-PDF file would fail in `extractPdf` with a clear error rather than producing empty text).

## What didn't change

The Markdown parser, the URL fetcher, the image localiser, the frontmatter extractor, and the LLM converters are all unchanged. The HTML branch is unchanged. The only new logic is the dispatch at the top of `convertToMarkdown`, the new binary branches, and the new `convertMarkdownInput` function for Markdown input. The 592 passing tests in 1.6.0 are a refactor's worth of tests, not a rewrite's worth.

## Why I think this is the interesting part of 1.6.0

The headline for v1.6.0 is "PDF, DOCX, and Markdown inputs join HTML and URLs." That is accurate, but the more interesting part of the release, in my view, is the dispatch. The function shape stays the same. The caller surface stays the same. The number of formats goes up. That is the right kind of refactor: a feature lands in user code as an *expansion* of what the existing entry point accepts, not a new entry point that callers have to learn.

Magic bytes as a discriminator is a small, specific technique. Using runtime type and `Buffer.isBuffer` is even smaller. Neither is novel on its own. What is novel is using them together to make a multi-format converter that doesn't ask the caller to know the format. That is the architectural claim of v1.6.0, and the dispatch is where it lives.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions
