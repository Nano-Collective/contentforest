---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "get-md v1.5.0: Pluggable LLMs, batch crawling, and RAG helpers"
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m2.7"
char_count: 0
---

get-md v1.5.0 is out. This is the biggest release since v1.0, with five new capabilities stacked on top of a full surface audit that fixed a dozen small issues. Here's what changed.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## Pluggable LLM backend

v1.5.0 makes the LLM backend pluggable instead of hard-wired to local `ReaderLM-v2`. It now routes through whichever provider you configure, using the same `sdkProvider` shape as [Nanotune](https://github.com/Nano-Collective/nanotune) and [Nanocoder](https://github.com/Nano-Collective/nanocoder), so one config covers the whole Nano Collective stack.

Supported providers: `openai-compatible` (Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, vLLM), `anthropic`, `google`, and `local-llama`. Peer dependencies are optional. Install only the provider you actually use. Missing peer deps surface a clear "install this" error instead of `ERR_MODULE_NOT_FOUND`.

Config files now support `${ENV_VAR}` and `${VAR:-default}` substitution, so `apiKey` values stay out of committed files. CLI flags `--llm-provider`, `--llm-base-url`, `--llm-model`, and `--llm-api-key` handle everything. Run `--show-config` to inspect your current setup; API keys are redacted.

Default behaviour is unchanged: existing setups with `useLLM: true` and no explicit provider continue to use `local-llama` as before.

## Batch mode

Two new API functions handle bulk URL conversion:

```typescript
// Yields per-URL results as they complete
const batch = convertBatch(urls, { concurrency: 5 });
for await (const result of batch) {
  console.log(result.markdown);
}

// Convenience: buffers everything into an array
const all = await convertBatchAll(urls, options);
```

CLI batch mode reads a file of URLs (one per line, `#` comments and blanks stripped), writes one `.md` per URL to an output directory, and produces a JSON manifest summary alongside. Concurrency, error handling, file naming patterns, and JSONL output are all configurable from the CLI.

## Sitemap crawling

`parseSitemap` fetches and parses a sitemap URL, recursively follows `<sitemapindex>` entries, and returns a flat list of all discovered URLs. `convertSitemap` composes that with the batch converter for a complete crawl-and-convert pipeline.

CLI usage:

```bash
getmd --sitemap https://example.com/sitemap.xml \
  --include "**/blog/**" \
  --exclude "**/drafts/**" \
  --max-depth 3 \
  --max-urls 10000
```

Glob filtering applies with `*` matching no slashes and `**` matching any characters. Default max depth is 3; default max URL count is 10000.

## RAG ingestion helpers

Two new exports make `get-md` composable as a RAG ingestion building block:

`chunkMarkdown(md, { maxTokens, overlap?, includeHeadingPath? })` splits markdown at heading boundaries. Each chunk carries the full heading path from root to its parent heading, prepended as an introductory line on continuation chunks. Overlap controls how many chunks carry a trailing overlap window from the previous chunk.

`estimateTokens(text)` provides a chars/4 heuristic for quick context-window budgeting. It is also surfaced automatically on `ConversionStats.estimatedTokens` for every single-URL conversion, so you get token estimates without any extra calls.

Both are available as standalone exports and are documented in the new API utilities guide.

## Image localisation

`convertToMarkdown` now accepts a `downloadImages: '<dir>'` option. It downloads referenced images in parallel, rewrites their `src` in the markdown to point at the local copies, and handles per-image failures gracefully. A single failed image prints a warning but never aborts the conversion. URL deduplication means a shared image referenced across multiple pages is downloaded once.

The CLI mirrors this with `--download-images <dir>`. When the positional input is a URL, the CLI now sets that URL as the implicit `baseUrl` so relative image refs (`/images/logo.svg`) resolve correctly without needing `--base-url`.

The HTML cleaner preserves lazy-load attributes (`data-src`, `data-original`, `data-lazy-src`, `srcset`) and resolves them against the base URL, which means Wikipedia, Medium, Substack, and most modern blog platforms produce complete image references instead of 1x1 placeholders.

## HTTP cache and retry

Transient failure handling is now built in. The converter retries on network errors, 5xx responses, and 429 rate-limit responses. Exponential backoff with up to 25% jitter is applied. On 429, it reads the `Retry-After` header and respects it (handles both the seconds form and HTTP-date).

An opt-in file-system cache (`~/.get-md/cache` or a custom path) skips the network entirely on cache hits. TTL is configurable per-call. Cache failures fall back to a live fetch rather than throwing, so the cache is always non-blocking.

CLI flags: `--retries`, `--retry-delay`, `--cache`, `--cache-dir`, `--cache-max-age <seconds>`.

## Safer fetches

A `maxBytes` option (default 10MB) caps what the fetcher will accept. If `Content-Length` declares more, the fetch is aborted before downloading. If a server omits or lies about the header, the stream is aborted mid-flight before unbounded buffering can occur. Combined with the retry and cache layers, the fetch path is now hardened against hostile or misbehaving sources.

## Image and output path fixes

Two longstanding rough edges are smoothed. Nested output paths like `--output ./nested/file.md` now auto-create the parent directory instead of crashing. And the model description copy that previously said "986MB" (the old legacy model) is corrected to "1.12GB" everywhere.

## Documentation

New API reference pages: `docs/api/batch.md`, `docs/api/sitemap.md`, and `docs/api/utilities.md`. The API index (`docs/api/index.md`) is restructured with every public export linked. The Conversion API page now uses "Conversion API" as its section label while keeping the same URL slug so existing deep links stay valid.

New guides: `docs/guides/remote-llm.md`, `docs/guides/batch.md`, and `docs/guides/sitemap.md`. Manual smoke-test crib sheets live in the repo root: `SMOKE_TESTS.md`, `CRAWL_SITEMAP.md`, `TEST_IMAGES.md`.

## Tests

528 tests (up from 405 at 1.4.1). New coverage for retry on 5xx/429/network errors, HTTP cache hit/miss/TTL, image localisation with relative refs and baseUrl, protocol-relative URLs, sitemap parsing (flat and nested), batch concurrency, chunking at heading boundaries, env-vars in config, and JSON output in both single and JSONL modes.

## What was fixed

- `--version` now reads from `package.json` at runtime instead of printing a hardcoded value.
- `llmMaxTokens` default lowered to 8192. The documented 512000 was always capped at 8192 internally. The fix is accuracy rather than behaviour.
- Stale `dist/parsers/json-parser.*` removed. `ajv` dependency dropped (unused in `src/`).
- Custom-rule state leak fixed: `MarkdownParser` now constructs a fresh `TurndownService` per `convert()` call.
- `Required<MarkdownOptions>` cast replaced with a proper `NormalizedMarkdownOptions` type, closing a type hole.
- `-o ./nested/file.md` now creates parent directories.

## Upgrading

Upgrade from npm:

```bash
npm install @nanocollective/get-md@latest
```

Or with pnpm:

```bash
pnpm add @nanocollective/get-md@latest
```

Node.js 22 or later is required. If you use the LLM path, check the new [Remote LLM Providers guide](docs/guides/remote-llm.md) if you want to switch away from the local model.

If you hit any issues or want to discuss the new features, open an issue or find us on [Discord](https://discord.gg/ktPDV6rekE).

Repo: https://github.com/Nano-Collective/get-md
