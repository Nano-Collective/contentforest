---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "How sitemap crawling works in get-md v1.5.0: parseSitemap and convertSitemap"
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

v1.5.0 adds two functions for working with sitemaps: `parseSitemap()`, which fetches a sitemap URL and returns a flat list of pages, and `convertSitemap()`, which runs the full pipeline from sitemap to converted markdown. Here is what both do and what the design decisions were.

## parseSitemap()

```typescript
const urls = await parseSitemap("https://example.com/sitemap.xml", options);
```

`parseSitemap()` fetches the input URL and parses it as XML. If it encounters a `<sitemapindex>`, it fetches each child sitemap recursively until it has a flat list of page URLs. The depth of that recursion is capped by `--max-depth` (default 3, meaning the sitemap index itself is depth 0 and its children are depth 1).

The returned value is `string[]` — a flat array of page URLs, deduplicated. No markdown, no conversion, just the URL list.

## convertSitemap()

```typescript
for await (const result of convertSitemap("https://example.com/sitemap.xml")) {
  console.log(result.markdown.length, result.url);
}
```

`convertSitemap()` composes `parseSitemap()` and `convertBatch()` internally. It first resolves the sitemap URL list, then feeds them to `convertBatch()` with the same concurrency semantics. The result is a streaming async iterator over `BatchResult` objects — same shape as `convertBatch()`.

In practice this means: pass a sitemap URL, iterate results as they complete. You get all the batch features — JSONL output, naming patterns, failure handling — without having to call `parseSitemap()` separately.

## Glob filters

Both CLI and API support `--include` and `--exclude` (repeatable flags) for filtering URLs before conversion. The glob syntax is deliberately simple:

- `*` matches within a single path segment — it does not cross slashes. `https://example.com/*/blog` matches `https://example.com/en/blog` and `https://example.com/fr/blog` but not `https://example.com/blog/posts`.
- `**` matches anything including slashes. `https://example.com/**` matches the full tree.
- The `--include` filter runs first. If you supply any `--include` patterns, a URL must match at least one of them to proceed.
- `--exclude` then removes URLs that match any exclude pattern.
- Order matters — include is evaluated, then exclude.

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --include "https://example.com/blog/**" \
  --exclude "https://example.com/blog/drafts/**" \
  -o out/
```

## Depth and URL caps

`--max-depth` (default 3) caps recursion into sitemapindexes. A sitemap index at `https://example.com/sitemap.xml` is depth 0. Its child sitemaps are depth 1. Pages inside those child sitemaps are depth 2. With the default, the crawler will follow at most two levels of sitemap index before stopping.

`--max-urls` (default 10000) caps the total number of URLs collected before conversion starts. This prevents accidental runaway crawls on sites with large sitemaps or deeply nested sitemapindexes.

In the API, both options are available on the options object passed to `parseSitemap()` and `convertSitemap()`.

## What crawlSitemap() does not do

`convertSitemap()` is not a general web crawler. It does not follow `robots.txt`. It does not infer URLs from page links. It works entirely from sitemap metadata — if a page is not in the sitemap, it will not be reached.

This is intentional. A sitemap gives you an authoritative list of the pages a site owner has decided to surface. The alternatives — scraping, link following — are out of scope for get-md and would require choices about rate limiting and politeness that belong in a separate crawler tool.

## What you use it for

The sitemap pipeline fills the gap between wanting to convert a whole site and wanting to write a one-off script to do it. It handles the sitemap machinery so you do not have to, and it builds on the batch infrastructure so failure handling, concurrency, and output naming are consistent across the product.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
