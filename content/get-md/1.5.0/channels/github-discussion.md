---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "get-md v1.5.0 - pluggable LLM backend, batch mode, sitemap crawling, image localization"
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

get-md v1.5.0 is out. This is the biggest release since v1.0, and it lands across five areas that together make the tool useful as a building block in larger pipelines, not just a one-off CLI converter.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## What changed

### Pluggable LLM backend

`useLLM: true` is no longer hard-wired to local ReaderLM-v2. It now routes through whichever provider you configure, using the same `sdkProvider` shape as Nanocoder and Nanotune so one config covers the full Nano Collective stack.

Supported providers: `openai-compatible` (Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, vLLM), `anthropic`, `google`, `local-llama`. When `useLLM: true` and no `llm` block is set, it defaults to `local-llama`, so existing setups keep working unchanged.

The provider packages are optional peer dependencies (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`, `@ai-sdk/google`). Install only what you use. Missing peer deps surface a clear "install this provider" error instead of `ERR_MODULE_NOT_FOUND`.

Environment variable substitution (`${ENV_VAR}` and `${VAR:-default}`) is now supported in config files, so `apiKey` never needs to live in committed JSON.

CLI flags for LLM: `--llm-provider`, `--llm-base-url`, `--llm-model`, `--llm-api-key`. `--show-config` redacts `apiKey` when printing.

### Batch mode

Two new async-iterator entry points: `convertBatch(urls, options)` yields per-URL results as they complete with bounded concurrency. `convertBatchAll(urls, options)` buffers everything into an array as a Promise convenience.

CLI: `--batch <file>` reads URLs from a file (one per line, `#` comments and blank lines stripped). Use `-o <dir>` to write one `.md` per URL. `--concurrency` (default 5) and `--stop-on-error` (default: continue) control behaviour. `--name-pattern` accepts placeholders: `{host}`, `{slug}`, `{path}`, `{index}`. `--manifest <file>` writes a JSON summary. `--json` in batch mode emits JSONL (one result per line) for streaming into `jq` or similar tools.

### Sitemap crawling

`parseSitemap(source, options)` fetches a sitemap URL (or parses raw XML), recursively follows `<sitemapindex>` entries, and returns a flat URL list.

`convertSitemap(sitemapUrl, options)` is the full pipeline: parses the sitemap and yields `BatchResult` per page via `convertBatch`.

CLI: `--sitemap <url>`. `--include` and `--exclude` are repeatable glob filters (`*` matches no slashes, `**` matches anything). `--max-depth` (default 3) and `--max-urls` (default 10000) cap the crawl.

### Image localization

`downloadImages: '<dir>'` on `convertToMarkdown` (CLI: `--download-images <dir>`) downloads referenced images in parallel and rewrites markdown `src` attributes to point at local copies. Per-image failures log a warning but never fail the conversion. Deduplication uses SHA256 prefixes for deterministic filenames, so re-runs overwrite cleanly.

Smart path rewriting: when `outputPath` is set, the rewritten image path is relative to the markdown file's directory. Markdown at `./out/page.md` with images at `./out/assets/foo.png` gets `./assets/foo.png` refs (no extra config needed).

CLI auto-baseUrl: when the positional input is a URL, the CLI now sets that as the implicit base URL so relative image refs (`/images/logo.svg`) resolve without needing `--base-url`.

Lazy-load support: the HTML cleaner preserves `data-src`, `data-original`, `data-lazy-src`, and `srcset` on `<img>` tags, resolving them against the base URL. Wikipedia, Medium, Substack, and most modern blog platforms use these for lazy loading; without preservation, only 1x1 placeholders survive.

### HTTP cache and retry

Retries on transient failures: network errors, 5xx, 429. Exponential backoff with up to 25% jitter. Honors `Retry-After` headers (parses both seconds and HTTP-date forms). Configurable via `retries` (default 2) and `retryDelay` (default 500ms). CLI: `--retries`, `--retry-delay`.

File-system cache: opt-in via `cache: true` (uses `~/.get-md/cache`) or `cache: '<path>'`. Cache hits skip the network entirely and the retry loop. `cacheMaxAge` (default 1 hour) controls TTL. CLI: `--cache`, `--cache-dir`, `--cache-max-age`. Cache failures fall back to a live fetch. They never throw.

### Bug fixes and smaller changes

- `getmd --version` now reads from `package.json` at runtime instead of reporting `"1.0.0"`.
- Model size copy corrected: the shipped Q4_K_M binary is 1.12GB, not 986MB as the old docs stated.
- `llmMaxTokens` default lowered to 8192 to match what the converter actually capped it at. Internal `LLMConverter` defaults reconciled with public ones (`0.1` / `8192`).
- Stale `dist/parsers/json-parser.*` removed (unused leftover). `ajv` dropped from dependencies. Build script now does `rm -rf dist` before `tsc` so this cannot recur.
- Custom-rule state leak fixed: `MarkdownParser` was reusing a single `TurndownService` across calls, causing user-supplied `customRules` to accumulate between conversions.
- `Required<MarkdownOptions>` cast in `normalizeOptions` replaced with a proper `NormalizedMarkdownOptions` type.
- New `maxBytes` option (default 10MB) on `fetchUrl` to prevent unbounded buffering from servers that misreport Content-Length.
- `-o ./nested/file.md` now auto-creates parent directories instead of crashing with `ENOENT`.

## Documentation

New API reference pages: `docs/api/batch.md`, `docs/api/sitemap.md`, `docs/api/utilities.md`. Restructured `docs/api/index.md` links every public export. The old `convertToMarkdown()` page is now "Conversion API" (URL slug unchanged so deep links survive).

New guides: `docs/guides/remote-llm.md`, `docs/guides/batch.md`, `docs/guides/sitemap.md`.

Manual smoke-test crib sheets in the repo root: `SMOKE_TESTS.md`, `CRAWL_SITEMAP.md`, `TEST_IMAGES.md`.

## Tests

528 passing (up from 405 at v1.4.1). New coverage for: retry on 5xx/429/network errors, `Retry-After` header honouring, HTTP cache hit/miss/TTL, image localization with relative refs and `baseUrl`, protocol-relative URLs, non-http(s) scheme skipping, CLI auto-baseUrl end-to-end, sitemap parsing (flat and nested), batch concurrency caps, chunking at heading boundaries, env-var substitution, and JSON/JSONL output.

## Upgrade notes

The `local-llama` provider is the new default for `useLLM: true`, so existing setups are unaffected. If you were using the `node-llama-cpp` peer dependency directly, nothing changes for you.

If you encounter any issues, drop an issue on [GitHub](https://github.com/Nano-Collective/get-md) or reach out on [Discord](https://discord.gg/ktPDV6rekE).