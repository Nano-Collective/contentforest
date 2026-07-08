---
product: get-md
version: "1.6.0"
channel: github-discussion
title: "How convertToMarkdown dispatches a Buffer to the right extractor"
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 15821
---

The headline for get-md v1.6.0 was "PDF, DOCX, and Markdown inputs join HTML and URLs." The interesting part is the *how*: a single function entry point, `convertToMarkdown`, now takes a string, a `Buffer`, or a `ContentSource` and routes the input to the right extractor without the caller threading a format flag. This post walks the dispatch logic in `src/index.ts` end to end, with the magic-byte branches front and centre.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## The shape of the function

```typescript
export async function convertToMarkdown(
  input: string | Buffer | ContentSource,
  options?: MarkdownOptions,
): Promise<MarkdownResult>
```

The signature alone is a useful artefact. The discriminator is the runtime type of `input`, not an `inputType` option, not a class hierarchy, not a builder. Three kinds of input, three top-level branches:

1. `Buffer.isBuffer(input)`, the binary case. This is where the magic-byte dispatch lives.
2. `typeof input === "string"`, the text case, which itself splits into a URL branch and a raw HTML / Markdown branch.
3. `ContentSource` object, a tagged union (`type: "html" | "markdown"`).

A single `forceExtractContentOff` boolean is hoisted to the top of the function. The PDF branch sets it to `true`. Everything that follows reads that flag, and Readability gets disabled for the rest of the call without the caller having to know the input was a PDF.

## Branch 1: `Buffer.isBuffer(input)`

```typescript
if (Buffer.isBuffer(input)) {
  const buffer = Buffer.from(input);
  if (buffer.subarray(0, 4).toString() === "%PDF") {
    // PDF path
  } else if (buffer.subarray(0, 2).toString("latin1") === "PK") {
    // DOCX path
  } else {
    throw new Error(
      "Unsupported binary format: expected a PDF (%PDF) or DOCX (ZIP) buffer.",
    );
  }
}
```

Two `subarray(0, N).toString(...)` checks against the leading bytes of the buffer. The PDF probe is four bytes (`%PDF`), the DOCX probe is two bytes (`PK`). Both magic numbers are well-defined: `%PDF` is the literal opening of every PDF, and `PK` is the local-file-header signature (`0x50 0x4B`, or `P` `K` in honour of Phil Katz) for every ZIP archive, which is what a `.docx` file actually is under the OOXML packaging convention.

There is no third option on the binary path. Markdown files are not binary. A `.md` buffer is still text and goes through the string branch. PDFs that don't open with `%PDF` (corrupt headers, encrypted files that the extractor can't crack) and DOCX files that don't open with `PK` both fail closed with a clear error rather than being guessed at.

The dispatch then diverges in a way that's worth tracing separately.

### The `%PDF` branch

```typescript
if (buffer.subarray(0, 4).toString() === "%PDF") {
  const { extractPdf, reconstructPdfHtml } = await import(
    "./extractors/pdf-extractor.js"
  );
  const { text: pdfText, pages: pdfPages, metadata: pdfMeta } =
    await extractPdf(buffer);
  if (!pdfText.trim()) {
    return emptyPdfResult(buffer.length);
  }
  inputHtml = buildPdfHtml(reconstructPdfHtml(pdfPages), pdfMeta);
  forceExtractContentOff = true;
}
```

Three things happen on this branch, in order:

1. The buffer is handed to `extractPdf` (in `src/extractors/pdf-extractor.ts`), which is a thin wrapper around `pdf-parse`'s `PDFParse` class. It returns `text` (all pages joined, with `-- N of M --` page markers stripped), `pages` (per-page text), and `metadata` (the PDF's info-dict `Title`, `Author`, and `CreationDate`, all best-effort).
2. If the joined text is empty, the function returns an `emptyPdfResult` with a non-zero `inputLength` (the byte length of the original buffer). Empty text plus non-zero bytes is the contract: the file was real, it just had no extractable text. This is the OCR-is-needed signal. The conversion does *not* throw, and the caller can detect the case via `stats.inputLength > 0 && result.markdown === ""`.
3. Otherwise, `reconstructPdfHtml` walks the per-page text and reflows it into structured HTML (headings, lists, paragraphs, with repeated running headers/footers dropped). That HTML is then wrapped by `buildPdfHtml` in a synthetic document that carries the PDF's title, author, and `publishedTime` as `<title>` and `<meta>` tags. The wrapped HTML is what gets fed back through the rest of the function as if the caller had passed HTML in directly. `forceExtractContentOff` is set to `true` so Readability stays out of it.

The result is that the rest of `convertToMarkdown` (parser setup, image localisation, return) never needs to know the input was a PDF. The binary branch *converts itself into the HTML branch* and the function proceeds as normal, modulo the one flag.

### The `PK` branch

```typescript
} else if (buffer.subarray(0, 2).toString("latin1") === "PK") {
  const { convertDocxToMarkdown } = await import(
    "./converters/docx-converter.js"
  );
  return await convertDocxToMarkdown(buffer, options);
}
```

This branch is shorter on purpose. DOCX is structurally more complex than PDF: the buffer is a ZIP, the file of interest is `word/document.xml` (and often `word/numbering.xml` for list resolution), and the OOXML inside needs to be walked and converted to a normalised HTML representation before it can hit the Markdown pipeline. That work lives in `converters/docx-converter.ts` and is not inlined into `convertToMarkdown`.

`convertDocxToMarkdown` extracts the OOXML, parses it into HTML, and then calls `convertToMarkdown` recursively with that HTML and `extractContent: false`. The recursive call goes down the string branch and the function exits the original call without doing any more work. The buffer is consumed end to end in this branch and the function returns the result.

This is a deliberate split. PDF text extraction is monolithic (one library call, text out the other side), so it lives in the index file's binary branch. DOCX needs real XML walking, so it lives in a dedicated module. The dispatch is the *one* place that knows the difference, and the only coupling between the binary branch and the rest of `convertToMarkdown` is the `forceExtractContentOff` flag set by the PDF path.

## Branch 2: `typeof input === "string"`

The string branch handles HTML strings, URLs, and URLs that point at PDFs. The discriminator is `options?.isUrl` first, then `isValidUrl(input)`:

```typescript
if (typeof input === "string") {
  inputHtml = input;
  if (options?.isUrl || isValidUrl(input)) {
    // URL path
  }
  contentSource = { type: "html", content: inputHtml };
}
```

The URL path then does *its own* PDF check, because the extension is a stronger signal than the bytes at this point (we don't have the bytes yet, we have a string):

```typescript
if (input.toLowerCase().endsWith(".pdf")) {
  const { fetchUrlBuffer } = await import("./utils/url-fetcher.js");
  const buffer = await fetchUrlBuffer(input, fetchOptions);
  const { extractPdf, reconstructPdfHtml } = await import(
    "./extractors/pdf-extractor.js"
  );
  const { text: pdfText, pages: pdfPages, metadata: pdfMeta } =
    await extractPdf(buffer);
  if (!pdfText.trim()) {
    return emptyPdfResult(buffer.length);
  }
  inputHtml = buildPdfHtml(reconstructPdfHtml(pdfPages), pdfMeta);
  forceExtractContentOff = true;
} else {
  inputHtml = await fetchUrl(input, fetchOptions);
}
baseUrl = baseUrl || input;
```

The `.pdf` suffix on a URL is treated as the same path as the `%PDF` magic-byte branch. The URL is fetched into a `Buffer` (via `fetchUrlBuffer`, the binary variant of the URL fetcher), and from that point on the code is the same: `extractPdf` + `reconstructPdfHtml` + `buildPdfHtml` + `forceExtractContentOff = true`. The URL string is also used as the implicit `baseUrl` so any relative URLs inside the PDF that survive extraction (rare, but possible) resolve correctly.

`.docx` URLs are not special-cased on this branch. The string-branch URL path always calls `fetchUrl` (text mode), which would corrupt the binary. The `ContentSource` branch and the `Buffer` branch are the supported entry points for DOCX. If you have a `.docx` URL, fetch it into a `Buffer` first and pass that. This is a deliberate limitation, not an oversight: the URL path is HTML-or-PDF, and the binary path handles the rest.

## Branch 3: `ContentSource`

```typescript
} else {
  // ContentSource: honor a `markdown` type by routing to the markdown
  // pipeline (the same behavior as the `inputType: "markdown"` option).
  if (input.type === "markdown") {
    return await convertMarkdownInput(input.content, { ...options, baseUrl });
  }
  contentSource = input;
  inputHtml = input.content;
}
```

`ContentSource` is the typed-object variant of "I know exactly what I'm giving you." A `{ type: "markdown", content: "..." }` source is routed to `convertMarkdownInput` immediately. A `{ type: "html", content: "..." }` source is set as `contentSource` and continues into the parser. The dispatcher trusts the tag.

There is also a separate, late check for `options?.inputType === "markdown"` further down, which routes the HTML branch's `inputHtml` to `convertMarkdownInput` if the caller signals "this string is already markdown" via the option rather than via the `ContentSource` tag. Same target function, two entry points.

## The `forceExtractContentOff` flag

The flag is the most consequential line in the dispatch:

```typescript
let forceExtractContentOff = false;
// ... later, in the parser setup:
const convertOptions = { ...options, baseUrl };
if (forceExtractContentOff) {
  convertOptions.extractContent = false;
}
```

Readability (Mozilla's content extractor) is a useful tool for HTML: it scores nodes, picks the article body, and throws away nav, footers, and asides. For a buffer that was already a PDF or DOCX, the *entire document* is the article body, and Readability's scoring will routinely drop short paragraphs, footnotes, and headers it can't recognise. We saw this in the wild: a multi-page PDF's table of contents would get stripped, a chapter heading would be re-scored as a nav element, body text would vanish.

The PDF path turns Readability off by setting the flag in the binary branch, before `convertOptions` is built. The DOCX path does the same thing, but at the `convertDocxToMarkdown` call site in `converters/docx-converter.ts`:

```typescript
return convertToMarkdown(html, {
  ...options,
  extractContent: false,
});
```

Both binary formats land in the same place: a parsed document, structure reconstructed, no Readability re-extraction. The HTML and URL branches leave the flag at its default of `false`, so Readability runs as it always has. The caller does not need to know this is happening.

## What the function looks like once dispatched

After the three branches, the function converges:

```typescript
const parser = new MarkdownParser();
const convertOptions = { ...options, baseUrl };
if (forceExtractContentOff) {
  convertOptions.extractContent = false;
}

if (options?.inputType === "markdown") {
  return await convertMarkdownInput(inputHtml, convertOptions);
}

const result = await parser.convertAsync(contentSource, convertOptions);
```

There is exactly one place where a `MarkdownParser` is constructed. There is exactly one place where `parser.convertAsync` is called. The image-localisation step at the bottom is the only post-processing, and it runs on the `result` from whichever branch got us here. This is the simplification that 1.6.0 buys: the *callers* no longer need to know the format. Internally, the dispatch is the only thing that does.

## Why the magic-byte check is on the buffer, not the option

You could express the same dispatch with a `format: "pdf" | "docx" | "html" | "markdown"` option. The code doesn't, and there are three reasons grounded in the implementation.

**Bytes are unambiguous.** A `Buffer` that opens with `%PDF` is a PDF; nothing else starts that way. A string `inputType: "pdf"` could be wrong, and a wrong `inputType` on a string input is a class of bug the magic-byte check makes impossible. The check is the same code path callers would otherwise have to write correctly themselves.

**Strings don't have magic bytes.** The URL branch uses the extension as a hint because that's the only signal available pre-fetch. The fetch is then treated as the same code path as a `Buffer` input: download, magic-byte-implied format, dispatch. A user who passes a `Buffer` directly and a user who passes a URL that returns a `Buffer` go through identical code from that point on.

**Forced options leak into user code.** If `convertToMarkdown` required `format: "pdf" | "docx"`, the caller would have to know the format of their own buffer. The whole point of the 1.6.0 refactor was to remove that requirement. The `Buffer` path's magic-byte check is what makes "pass me anything, I'll figure it out" a real claim rather than marketing.

## The CLI's view of the same problem

The CLI in `src/cli.ts` has the same problem in a different shape, because the CLI takes a path or a URL, not a `Buffer`. The dispatcher there lives in `getInput`:

```typescript
async function getInput(input?: string): Promise<{
  content: string | Buffer;
  inputType: "html" | "markdown" | "pdf";
}> {
  // URL path: `.pdf` suffix on URL -> Buffer
  // File path: `.pdf` extension -> Buffer
  // Stdin: magic-byte check on the first 4 bytes
  if (buf.subarray(0, 4).toString() === "%PDF") {
    return { content: buf, inputType: "pdf" };
  }
  return { content: buf.toString("utf-8"), inputType: "html" };
}
```

The CLI uses the extension for files and URLs, and falls back to the same `%PDF` magic-byte check on stdin (where there is no extension). The shape is the same: bytes-or-extension-implied format, then route to the right path. The CLI then calls into `convertToMarkdown` with the buffer, and the dispatch in `src/index.ts` does the same magic-byte check that confirmed the file's identity in the CLI. Redundant on the happy path, defensive on the unhappy path (a `.pdf` extension on a non-PDF file would fail in `extractPdf` with a clear error rather than producing empty text).

## What didn't change

The Markdown parser, the URL fetcher, the image localiser, the frontmatter extractor, and the LLM converters are all unchanged. The HTML branch is unchanged. The only new logic is the dispatch at the top of `convertToMarkdown`, the new binary branches, and the new `convertMarkdownInput` function for Markdown input. The 592 passing tests in 1.6.0 are a refactor's worth of tests, not a rewrite's worth.

## The shape of the fix for a class of bugs

The launch-hardening pass that landed alongside the multi-format support was a real fix, not a clean-up. The PDF and DOCX buffer paths are new code, and the bugs that surfaced in review were bugs in that new code:

- **PDF body text dropped by Readability.** Fixed by `forceExtractContentOff = true` on the PDF branch.
- **DOCX list types flipping at random.** Fixed in the DOCX converter by resolving list type from `word/numbering.xml` instead of `numId` parity.
- **DOCX buffers throwing on `convertToMarkdown`.** Fixed by adding the `PK` branch.
- **Markdown input doubling frontmatter or clobbering title.** Fixed in `convertMarkdownInput` by splitting the existing frontmatter off the body before generating new metadata and merging back.

The shape of the fix is consistent: *detect the input format as early as possible, route to a single-purpose path, do not let the wrong path's heuristics corrupt the right path's output.* The magic-byte check at the top of the buffer branch is the architectural expression of that.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions
