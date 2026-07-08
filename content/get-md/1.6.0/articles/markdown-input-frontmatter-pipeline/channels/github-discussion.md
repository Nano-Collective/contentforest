---
product: get-md
version: "1.6.0"
channel: github-discussion
title: "Why feed existing Markdown back through get-md"
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 19706
---

When the v1.6.0 release notes said the Markdown input path "skips HTML parsing and runs only the optimization passes," it sounded like a smaller change than the PDF and DOCX additions. In practice it closes the loop on the most common mixed-corpus workflow get-md is asked to handle: a folder of files that started life in mixed formats and is heading, eventually, into a single RAG pipeline. This post is a deep dive on what the Markdown input path actually does, why it does it that way, and how the frontmatter handling makes it usable as the consistent-metadata pass across HTML, PDF, DOCX, and Markdown sources.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## The two-stage shape of a get-md call

Before talking about the Markdown path specifically, it helps to be explicit about what the HTML path does, because the Markdown path is a deliberate, smaller version of the same pipeline.

`convertToMarkdown` on an HTML string goes through a multi-step pipeline in `MarkdownParser.convertAsync`:

1. Readability extraction: pick the article body out of the surrounding page chrome (nav, footer, asides).
2. Metadata extraction: title, author, published time, canonical URL, language, excerpt.
3. HTML cleaning: strip scripts, styles, cookie banners, ads.
4. Structure enhancement: improve heading hierarchy, normalise code blocks.
5. Filter pass: honour `includeLinks`, `includeImages`, `includeTables`.
6. Conversion to Markdown: Turndown + GFM.
7. Post-processing: blank-line collapse, code-block spacing, heading spacing.
8. Frontmatter emission: a YAML block at the top with the extracted metadata.

The Markdown input path is the same pipeline with steps 1-4 skipped. There is no HTML to parse, so the HTML-specific steps (Readability, cheerio/Turndown, structure enhancement, code-block normalisation) are simply absent. Steps 5 (filter), 7 (post-process), and 8 (frontmatter) still run. Steps 2 and 6 have a Markdown-specific replacement.

The function is `convertMarkdownInput` in `src/index.ts`, called from two places: when a string input comes in with `options.inputType === "markdown"`, and when a `ContentSource` arrives tagged `type: "markdown"`. The CLI also routes `.md` and `.markdown` files through it (the CLI detects the extension and sets `inputType` itself). The dispatch logic in `convertToMarkdown` is described in detail in the sibling article on buffer magic bytes; what matters here is that all three entry points converge on `convertMarkdownInput` with the same options shape.

## Why skip HTML parsing on Markdown

The first question is "why not just round-trip it through the HTML path?" There is a real cost.

HTML parsing is the slowest step in a get-md call. It loads happy-dom, runs the document through Mozilla Readability, walks every node to score it, then re-extracts the picked subtree. For a 10-KB Markdown file with no nav or ads, that is a lot of work to recover the document you already have. Worse, the heuristics can degrade the input. Readability's scoring prefers nodes with lots of text and punctuation density; it routinely drops short paragraphs, blockquotes, footnote lines, definition lists, and the first line of code blocks (which often scores low because it lacks punctuation). On a hand-edited Markdown file, those are features, not noise.

There is also a structural reason. The Markdown input path does not have an intermediate HTML representation to lose fidelity to. Every line of a Markdown file already has a meaning the Markdown pipeline can read directly: `#` for headings, `-` for lists, `> ` for blockquotes, fenced ``` for code blocks, GFM tables with `|`. Re-encoding all of that as HTML and then asking Turndown to recover it is a lossy round trip for no gain.

So `convertMarkdownInput` is written as a series of small, focused passes that operate on Markdown text directly. There is no parser construction, no Turndown instance, no cheerio, no Readability.

## How existing frontmatter is preserved

This is the part that broke before v1.6.0 shipped, and the part that was worth fixing carefully. The bug class: a Markdown file with its own YAML frontmatter block at the top, fed through a converter that also emits a frontmatter block from extracted metadata, ends up with either two stacked YAML blocks or one block whose `title` was clobbered by the converter's guess. Both are bad. Two blocks means frontmatter parsers that only read the first block see user-set values; parsers that scan for any block see noise. A clobbered title means the document author's real title disappears.

The fix is structural. `convertMarkdownInput` calls `splitFrontmatter` first, before anything else runs:

```typescript
function splitFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  if (!markdown.startsWith("---")) return { frontmatter: null, body: markdown };
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: markdown };
  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
}
```

`splitFrontmatter` returns the raw inner lines of the leading YAML block (without the `---` fences) and the body that follows. A document that does not start with `---` returns `frontmatter: null` and the whole document as the body. A document that starts with `---` but does not have a matching closing `---` also returns `frontmatter: null` rather than treating a malformed opener as a real frontmatter block. Both behaviours are deliberate; the rule is "if the block is not well-formed, treat the file as a body."

The existing keys are then parsed with `parseFrontmatterKeys`, which builds a `Map<string, string>` of `key: value` lines. Only the keys that exist in the file land in the map; the value is the raw string with any surrounding YAML quotes stripped via `stripYamlQuotes`. The map is passed into `extractMarkdownMetadata` as the second argument.

`extractMarkdownMetadata` uses the existing frontmatter keys as the authoritative source for `title`, `author`, and `excerpt` (or `description`). When the map has a `title`, that title wins. When it does not, the function falls back to a body heuristic: the first `#`-prefixed heading. Same shape for `author` (frontmatter only, no body heuristic; there is no reliable way to extract an author from Markdown body text), and `excerpt` (frontmatter `excerpt` or `description`, else the first body paragraph that is not a heading, list item, table row, or code-fence line).

The point of this is: the document author's title and author always win. They are the human intent for those fields, and a body heuristic is, by definition, less authoritative.

Word count and reading time are different. Those are computed facts about the body, not author intent, and they are always recomputed from the body:

```typescript
const { wordCount, readingTime } = calculateMarkdownWordStats(body);
metadata.wordCount = wordCount;
metadata.readingTime = readingTime;
```

`calculateMarkdownWordStats` strips frontmatter (it has its own internal frontmatter skip), code blocks, inline code, URLs, and Markdown link/image syntax before counting. This matches the HTML path's word-count rules and means the numbers on a Markdown input are directly comparable to the numbers on an HTML input of the same content. That matters for the RAG-usage case below.

## How the frontmatter gets re-attached

After metadata extraction and content filtering, `convertMarkdownInput` has three pieces: the original frontmatter block (raw inner lines, no fences), a fresh `ContentMetadata` object, and the filtered body. The reassembly has three branches, matching the cases that need different handling.

**Case 1: existing frontmatter present, `includeMeta` on (the default).** The function calls `mergeMarkdownFrontmatter`, which appends the computed `wordCount` and `readingTime` only if those keys are not already in the user's block:

```typescript
function mergeMarkdownFrontmatter(
  frontmatter: string,
  metadata: ContentMetadata,
  body: string,
): string {
  const keys = parseFrontmatterKeys(frontmatter);
  const additions: string[] = [];
  if (!keys.has("wordCount") && metadata.wordCount !== undefined) {
    additions.push(`wordCount: ${metadata.wordCount}`);
  }
  if (!keys.has("readingTime") && metadata.readingTime !== undefined) {
    additions.push(`readingTime: ${metadata.readingTime}`);
  }
  const inner = frontmatter.replace(/\s+$/, "");
  const block = additions.length ? `${inner}\n${additions.join("\n")}` : inner;
  return `---\n${block}\n---\n\n${body}`;
}
```

If the user already set a `wordCount` (rare, but possible for hand-curated RAG corpora), it is preserved. Otherwise it is appended. Same for `readingTime`. Title and author are never written into the block because they were never removed from it; they were already there.

The output is one YAML block, containing the original keys plus the computed stats, opening with `---`, closing with `---`, followed by a blank line and the body. No second block. No clobbering.

**Case 2: no existing frontmatter, `includeMeta` on.** `MarkdownParser.addMarkdownFrontmatter` is called. It builds a fresh YAML block from the `ContentMetadata` object, omitting undefined or null values, and prepending the block to the body. Title comes from the body heuristic (first H1), author is absent because there is no frontmatter to read it from, excerpt from the first long paragraph, wordCount and readingTime computed.

**Case 3: `includeMeta: false`.** The function does nothing to attach or strip frontmatter. The body, post-filter, post-post-process, is the output verbatim. Any leading frontmatter that was split off at the top has been discarded; the user's setting says "I do not want metadata in my output," and that includes the user's own. This is intentional and matches the HTML path's `includeMeta: false` behaviour, where the existing `<meta>` tags are dropped along with the generated frontmatter.

The net effect: there is no path through `convertMarkdownInput` that produces a doubled frontmatter block, and there is no path through it that clobbers a user-set `title` or `author`.

## Content filters on the body

The Markdown input path honours `includeLinks`, `includeImages`, and `includeTables`. The HTML path drops these in the HTML cleaning stage, before Turndown runs; on the Markdown path there is no HTML cleaning stage, so the filters live in `filterMarkdownContent`, which operates directly on Markdown text.

The filter has to be careful with fenced code blocks: rewriting image syntax inside a code fence would corrupt it. The function splits the body on fenced blocks and rewrites only the non-fence segments:

```typescript
const segments = markdown.split(/(```[\s\S]*?```)/g);
return segments
  .map((seg, i) => {
    if (i % 2 === 1) return seg; // odd-indexed = fenced block
    // ...rewrite images, links, tables...
  })
  .join("");
```

Within each non-fence segment, images are stripped first (image syntax is a superset of link syntax), then links are converted to plain text by replacing `[text](url)` with `text`, then GFM tables are dropped by walking lines and skipping any header + separator + contiguous body-rows triple.

The filter is conservative. Inline code is not touched. HTML embedded inside Markdown (the CommonMark allows-it extension) is not parsed or rewritten. Setext headings (`Heading\n=====`) are left alone. The point is to honour the flags without rewriting Markdown syntax that does not match the patterns above; if a document has tables encoded as HTML, the `includeTables: false` filter will leave them in. This is a deliberate trade-off, documented in the API reference.

## The RAG use case

The reason this matters in practice is mixed-corpus ingestion. A typical setup looks like this: a folder of files pulled from different places, headed for chunking, embedding, and a vector store. Some files are HTML pages exported from a CMS. Some are PDFs from research portals. Some are DOCX files from collaborators who refuse to use Markdown. Some are existing Markdown notes from a wiki or a previous run of an ingestion pipeline. All of them need to land in the vector store as Markdown, with consistent metadata (title, author, source, wordCount, readingTime), and with consistent content-shape choices (no images in the embedded text, tables converted or stripped, links dropped, etc.).

Without a Markdown input path, the existing-Markdown files are the awkward case. They have already been through the pipeline once. You can either skip them (and let them rot in the corpus folder), or you can pass them through get-md's HTML path (and watch Readability drop your footnotes), or you can write a parallel pipeline that knows about Markdown. None of those are great.

With the Markdown input path, the same `convertToMarkdown` call handles all four formats:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";
import { promises as fs } from "node:fs";

async function ingest(path: string): Promise<void> {
  const buf = await fs.readFile(path);
  const result = await convertToMarkdown(buf, {
    includeImages: false,
    includeLinks: false,
    baseUrl: `file://${path}`,
  });
  await chunkAndEmbed(result.markdown, result.metadata);
}
```

A PDF lands with `title`, `author`, and `publishedTime` from the PDF info dictionary. A DOCX lands with `title` from the document properties. An HTML string lands with `title` from the `<title>` tag or Open Graph metadata. A Markdown file lands with `title` from its existing frontmatter (if any) or its first H1. In all four cases, `wordCount` and `readingTime` are computed consistently by the same logic operating on the body text, and the `includeLinks`/`includeImages`/`includeTables` filters apply uniformly.

The mixed-source metadata consistency is the actual win. The corpus-level metadata table looks the same whether the row came from a PDF or a `.md` file. The downstream chunker can index on `metadata.title` and `metadata.author` without caring about source format. A/B-ingest experiments that swap an HTML source for a Markdown source do not change the metadata contract.

There is a subtler benefit for re-ingestion. If a corpus gets rebuilt periodically and most sources are Markdown already (a wiki, a notes folder), the rebuilt chunks need fresh `wordCount`/`readingTime` after any edits but should keep the human-authored `title` and `author`. The merge logic in `mergeMarkdownFrontmatter` handles exactly that case: it recomputes the stats, keeps the author-set keys, never writes a second block.

## What the function does not do

A few things are worth naming explicitly so callers know not to expect them.

It does not run Readability. There is no HTML to extract from. Callers who want a "minimal Markdown pass" should not pass HTML strings with `inputType: "markdown"`; the string would be treated as Markdown and emitted essentially unchanged (modulo filtering and post-processing).

It does not call the LLM converter. The `useLLM: true` option is a no-op on the Markdown input path. The LLM path is for HTML-to-Markdown, where structure recovery is the hard part. On a Markdown input there is no structure to recover; calling the LLM would just re-format text you already have.

It does not parse HTML embedded in Markdown. A Markdown file containing `<table>...</table>` is left as-is by the `includeTables: false` filter. If a corpus mixes GFM tables and HTML tables, callers who want strict filtering need to pre-normalise.

It does not handle multi-document YAML streams. A single Markdown file is one document. Splitting is the caller's job, and the new `chunkMarkdown` utility (added in v1.5.0) is the right tool for that.

It does not validate the user's existing frontmatter schema. If a user has set `tags: [foo, bar]` in a list form, `parseFrontmatterKeys` only reads `key: scalar` lines and ignores the list. The list is preserved in the output as part of the raw inner block, because `mergeMarkdownFrontmatter` only appends the computed stats; it does not touch what was already there. This means the user's structured frontmatter survives a pass through get-md even when get-md does not understand its shape. The computed stats get appended as plain scalars.

## The CLI surface

The CLI in `src/cli.ts` routes `.md` and `.markdown` files through the Markdown input path. It detects the extension, sets `inputType: "markdown"`, and calls `convertToMarkdown`. The relevant flags all work:

```bash
getmd notes.md -o notes.clean.md
getmd notes.md --no-frontmatter -o notes.bare.md
getmd notes.md --no-links --no-images --no-tables -o notes.text-only.md
```

Stdin is not auto-detected as Markdown. There is no magic-byte prefix for Markdown the way `%PDF` works for PDF; the CLI cannot reliably distinguish Markdown from HTML on stdin without a strong signal, and treating HTML as Markdown silently would corrupt HTML pipes. Pass a file path for Markdown. The CLI help text now reflects this: stdin is HTML by default, with `%PDF` checked as a fallback for PDF; `.md` files go through the Markdown path explicitly.

## Why this is a launch-hardening fix, not a feature

It is worth being honest about the framing. The Markdown input path existed before v1.6.0 in some form, and the most visible improvements in this release are the new PDF and DOCX paths. But the Markdown path was the one that was buggy on real inputs in a way that mattered.

A real `.md` file in a real corpus already has a YAML block with `title`, `author`, `tags`, `canonicalUrl`, sometimes a `source`. The old path would write a second block on top, and parsers downstream would either fail or pick the wrong block. The fix is not "add a Markdown input path" (that already existed); the fix is "do not corrupt the frontmatter the user already wrote." That is a small change in lines of code, but it is the change that makes the path usable in a real ingestion job rather than a demo.

The same review pass also caught that `--no-links`, `--no-images`, and `--no-tables` were not honoured on the Markdown path. That is fixed in v1.6.0. The Markdown input path now sits on the same content-filtering contract as the HTML path: the same option names, the same defaults, the same effect on the output body. A corpus ingestion job that sets `includeImages: false` once gets the same shape from HTML, PDF, DOCX, and Markdown sources.

## Where to read more

The Markdown input section in the [Conversion API](https://docs.nanocollective.org/get-md/docs/api/convert-to-markdown) reference covers the options (`inputType`, `includeLinks`, `includeImages`, `includeTables`, `includeMeta`) and the three input shapes that route through the path. The CLI reference documents `.md` and `.markdown` extension detection and the `--no-frontmatter`/`--no-links`/`--no-images`/`--no-tables` flags. The 592 passing tests in v1.6.0 include dedicated coverage for frontmatter preservation, content filtering, and the merge-vs-create behaviour described above.

If you have a mixed-format corpus headed into a RAG pipeline, the short version is: `convertToMarkdown(buffer, options)` handles all four formats, `metadata.title`/`metadata.author`/`metadata.wordCount`/`metadata.readingTime` come back the same shape regardless of source, and existing frontmatter on a Markdown input is preserved rather than clobbered. That is what v1.6.0 closes the loop on.

Repo: https://github.com/Nano-Collective/get-md
Discussion: https://github.com/Nano-Collective/get-md/discussions