---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m2.7"
char_count: 0
---

The v1.5.0 release of get-md added a pair of functions that make bulk URL extraction straightforward: `parseSitemap` and `convertBatch`. They compose into `convertSitemap`, but you can call each piece separately depending on what you need.

`parseSitemap` fetches a sitemap URL (or a raw XML string) and recursively walks any `<sitemapindex>` entries up to a depth cap (default 3). It returns a flat `string[]` of page URLs, with two filtering layers: `include` keeps URLs matching glob patterns, `exclude` drops ones that match (applied after include). The glob engine is built in. It supports `*`, `**`, and `?` with no extra dependency.

`convertBatch` takes a URL list and runs `convertToMarkdown` against it with bounded concurrency. It is an async generator that yields `BatchResult` objects as each URL completes, not in input order. A fixed pool of workers (controlled by `concurrency`, default 5) pulls from a shared queue, so memory usage stays bounded even for very large batches.

Here is what the full pipeline looks like in code:

```typescript
import { convertBatch, parseSitemap } from "@nanocollective/get-md";

const urls = await parseSitemap("https://example.com/sitemap.xml", {
  include: ["**/blog/**", "**/docs/**"],
  exclude: ["**draft**"],
  maxUrls: 5000,
});

for await (const result of convertBatch(urls, { concurrency: 5 })) {
  if (result.status !== "ok") continue;
  console.log(`${result.url}: ${result.stats.estimatedTokens} tokens`);
  await save(result.markdown);
}
```

The CLI mirrors this for non-script use cases:

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/blog/**" \
  --exclude "**draft**" \
  --max-urls 5000 \
  --concurrency 5 \
  -o ./out/
```

The `--batch` variant takes a text file of URLs instead of a sitemap. Both modes support `--json` for JSONL output (one result per line) and `--manifest` for a JSON summary. Retries, caching, and the pluggable LLM backend all apply to batch and sitemap modes the same way they do to single-URL conversions.

Repo: https://github.com/Nano-Collective/get-md