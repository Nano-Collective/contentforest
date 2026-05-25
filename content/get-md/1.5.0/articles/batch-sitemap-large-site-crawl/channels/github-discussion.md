---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "Bulk URL conversion — how to crawl an entire site with get-md"
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m2.7"
char_count: 0
---

Bulk URL conversion in get-md v1.5.0 is built from two primitives that compose cleanly: `parseSitemap` (walks a sitemap.xml and returns a flat URL list) and `convertBatch` (runs `convertToMarkdown` across that list with bounded concurrency). `convertSitemap` is the one-liner that wires them together, but you can also call each piece separately for more control.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## How the async iterator works

`convertBatch(urls, options)` returns an async generator. It does not collect all results before returning them. Instead, a fixed pool of workers (controlled by `concurrency`, default 5) each pull from a shared queue. As each worker finishes a URL, the result goes into an in-memory buffer and the main loop yields it immediately. Results arrive in completion order, not input order.

```typescript
import { convertBatch } from "@nanocollective/get-md";

for await (const result of convertBatch(urls, { concurrency: 5 })) {
  if (result.status === "ok") {
    console.log(`${result.url}: ${result.markdown.length} chars`);
  } else {
    console.error(`${result.url}: ${result.error.message}`);
  }
}
```

The internal worker pool is a plain array of promises. When the queue is empty and all workers have finished, the loop exits. For small batches where you want the full array in memory, `convertBatchAll(urls, options)` is a thin wrapper that collects everything into a `Promise<BatchResult[]>`.

The `BatchResult` shape is:

```typescript
type BatchResult =
  | { status: "ok"; url: string; markdown: string; metadata: ContentMetadata; stats: ConversionStats }
  | { status: "error"; url: string; error: Error };
```

`ConversionStats.estimatedTokens` (chars / 4) is available on every ok result, which means you get token budgeting without any extra calls.

## parseSitemap and convertSitemap

`parseSitemap` fetches a sitemap URL and recursively walks any `<sitemapindex>` entries up to a depth cap (default 3). It returns a flat `string[]` of page URLs. Two filtering layers apply:

- `include` - only keep URLs matching at least one glob pattern
- `exclude` - drop URLs matching any glob pattern (applied after include)

The glob engine is built in. It supports `*` (matches anything except `/`), `**` (matches including `/`), and `?` (single character except `/`). No new dependency required.

```typescript
import { parseSitemap } from "@nanocollective/get-md";

const urls = await parseSitemap("https://example.com/sitemap.xml", {
  include: ["**/blog/**", "**/docs/**"],
  exclude: ["**draft**", "**/private/**"],
  maxUrls: 5000,
});
```

`convertSitemap` composes `parseSitemap` with `convertBatch` in a single call. It yields the same `BatchResult` objects, so downstream code does not need to know whether the URL source was a sitemap or a manual list:

```typescript
import { convertSitemap } from "@nanocollective/get-md";

for await (const result of convertSitemap("https://example.com/sitemap.xml", {
  include: ["**/docs/**"],
  concurrency: 5,
  useLLM: true,
})) {
  if (result.status !== "ok") continue;
  await save(result.url, result.markdown);
}
```

## CLI: sitemap mode

The CLI exposes both functions under `getmd --sitemap`:

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/blog/**" \
  --exclude "**draft**" \
  --max-depth 3 \
  --max-urls 10000 \
  --concurrency 5 \
  -o ./out/
```

`--include` and `--exclude` are both repeatable. `--max-depth` controls nested sitemap index recursion (default 3). `--max-urls` is a hard cap on URLs taken from the sitemap (default 10000) to stop a runaway crawl against a large ecommerce sitemap.

When the input is a URL, the CLI sets it as the implicit `baseUrl` so relative image refs (`/images/logo.svg`) resolve correctly without needing `--base-url` explicitly.

## CLI: batch mode

Batch mode takes a file of URLs (one per line, `#` comments and blank lines stripped) rather than a sitemap:

```bash
getmd --batch urls.txt -o ./out/ --concurrency 3 --manifest ./summary.json
```

`--manifest` writes a JSON summary with per-URL status and a file path for every ok result. `--stop-on-error` aborts on the first failure; the default behaviour continues and records the error on each URL.

For streaming output into other tools:

```bash
getmd --batch urls.txt --json | jq '.url, .stats.estimatedTokens'
```

`--json` in batch mode emits JSONL (one JSON object per line). One failed URL produces one JSON object with `status: "error"` rather than crashing the pipe.

## Bounded concurrency under the hood

The concurrency cap is enforced by starting `Math.min(concurrency, urls.length)` workers upfront. Each worker loops by calling `queue.shift()` until the queue is empty. Results are pushed to a `ready` array; the outer `while` loop yields from that array as long as it has items. When the buffer is empty but workers are still running, it parks on a `Promise` that the next worker completion resolves.

This means the memory footprint is bounded by `concurrency` rather than `urls.length`, even for very large batches. A 50,000-URL crawl uses the same fixed pool of 5 workers (or whatever you set) as a 10-URL test.

## Combining with RAG pipelines

The chunking helpers make the batch/sitemap output directly usable as a RAG ingestion step:

```typescript
import { convertBatch, chunkMarkdown } from "@nanocollective/get-md";

for await (const result of convertBatch(urls, { concurrency: 5, useLLM: true })) {
  if (result.status !== "ok") continue;
  const chunks = chunkMarkdown(result.markdown, {
    maxTokens: 1000,
    overlap: 100,
    includeHeadingPath: true,
  });
  for (const chunk of chunks) {
    await embed(chunk.content, {
      source_url: result.url,
      heading: chunk.headingPath.join(" / "),
    });
  }
}
```

`chunkMarkdown` splits at heading boundaries. Each chunk carries the full heading path from the document root, prepended as an introductory line on continuation chunks so chunk boundaries remain readable in context.

## HTTP reliability

Both `convertBatch` and `convertSitemap` inherit the HTTP retry and cache layer. Retries fire on network errors, 5xx, and 429 responses. On 429, the `Retry-After` header is honoured in both seconds and HTTP-date form. Exponential backoff with up to 25% jitter is applied between attempts.

The file-system cache (enabled with `--cache` or `cache: true`) stores successful responses under `~/.get-md/cache` with a configurable TTL (default 1 hour). A cache miss or cache failure falls back to a live fetch rather than throwing, so the cache is always non-blocking.

For RAG pipelines where you iterate on chunking or embedding logic, caching the HTML fetches means re-runs are local-disk speed instead of network speed. Adjust TTL with `--cache-max-age` (seconds) to control freshness.

See the [Sitemap Crawling guide](https://docs.nanocollective.org/get-md/docs/v1.5.0/guides/sitemap.md) and [Batch Mode guide](https://docs.nanocollective.org/get-md/docs/v1.5.0/guides/batch.md) for the full reference.

Repo: https://github.com/Nano-Collective/get-md