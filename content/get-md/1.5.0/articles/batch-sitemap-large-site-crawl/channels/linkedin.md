---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m3"
char_count: 0
---

Bulk URL conversion in get-md v1.5.0 works in two layers that compose cleanly. `parseSitemap` walks a sitemap.xml or sitemap index and returns a flat list of page URLs, with glob filtering and depth/URL caps built in. `convertBatch` then runs `convertToMarkdown` across that list with a fixed worker pool so memory usage stays bounded regardless of batch size.

The CLI exposes both through `getmd --sitemap`. Give it a sitemap URL, a glob filter to narrow the scope, and a concurrency setting to stay within your provider's rate limits:

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/docs/**" \
  --exclude "**draft**" \
  --concurrency 5 \
  -o ./out/
```

Behind the CLI, `convertSitemap` is the composition of those two functions. In code, the same pipeline is available directly:

```typescript
for await (const result of convertSitemap("https://example.com/sitemap.xml", {
  include: ["**/docs/**"],
  concurrency: 5,
})) {
  if (result.status !== "ok") continue;
  await save(result.url, result.markdown);
}
```

Results arrive in completion order via an async iterator. For smaller batches where you want the full result set in memory, `convertBatchAll` wraps the iterator and returns a Promise. Both shapes share the same `BatchResult` type: either ok (markdown, metadata, stats) or error (url, error message).

When you pair this with the chunking helpers (`chunkMarkdown`) and the pluggable LLM backend, the output from a sitemap crawl feeds directly into a RAG pipeline without additional glue code.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Repo: https://github.com/Nano-Collective/get-md