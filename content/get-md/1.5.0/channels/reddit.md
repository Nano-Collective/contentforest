---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-05-26T23:33:05.744Z"
---

We shipped get-md v1.5.0 today. This is the biggest release since we put it out on npm back at v1.0, and we wanted to walk through what is actually in it.

**Pluggable LLM backend** is probably the biggest architectural shift. Before this, `useLLM: true` was locked to a local ReaderLM-v2. Now it routes through whichever provider you configure. OpenAI-compatible, Anthropic, Google, or local-llama as the default. The config shape mirrors what Nanotune and Nanocoder use, so one config covers the whole Nano Collective stack. We made the AI provider peer dependencies optional, so you only install the one you want. If you forget one, it gives you a plain error message telling you which package to install.

Config files gained `${ENV_VAR}` substitution with a `${VAR:-default}` form, so API keys do not have to live in committed files. CLI options cover everything if you prefer flags over config.

**Batch mode** is what most people asked us for. `convertBatch` is an async iterator that yields per-URL results as they complete, with bounded concurrency. `convertBatchAll` is the Promise convenience that buffers to an array. CLI batch mode reads a URL list file, writes one `.md` per URL, and produces a JSON manifest. You can tune concurrency, error handling, naming patterns, and get JSONL output for piping into `jq`.

**Sitemap crawling** is the second bulk workflow. `parseSitemap` fetches a sitemap, follows `<sitemapindex>` recursively, and returns a flat URL list. `convertSitemap` builds a complete crawl-and-convert pipeline from that. CLI glob filtering lets you include or exclude specific paths, and there are max-depth and max-urls caps.

**RAG ingestion helpers** are two small things that make a difference if you are building a pipeline: `chunkMarkdown` splits markdown at heading boundaries, tracks the full heading path per chunk, and drops it into continuation chunks so you always know context. `estimateTokens` is a chars/4 heuristic that also surfaces on `ConversionStats.estimatedTokens` automatically for every conversion so you get token budgets without calling it separately.

**Image localisation**: `downloadImages: '<dir>'` on `convertToMarkdown` (CLI: `--download-images <dir>`) downloads referenced images in parallel, rewrites their src to local paths, and keeps going if a single image fails. URL deduplication means shared images are fetched once. When the CLI takes a URL as input, it sets that URL as the implicit baseUrl so relative image refs work without a separate flag.

**HTTP reliability**: retries on network errors, 5xx, and 429 with exponential backoff and jitter, honouring `Retry-After` headers. An opt-in filesystem cache skips the network on hits. A `maxBytes` cap (default 10MB) prevents unbounded buffering if a server misbehaves.

**What we fixed**: `--version` was hardcoded to 1.0.0, the model size copy said 986MB instead of 1.12GB, `llmMaxTokens` advertised 512000 but was always capped at 8192 internally, a stale json-parser module was left over in dist, custom rules were leaking state between conversions, and nested output paths were crashing instead of creating parent directories.

528 tests, up from 405 at 1.4.1. New coverage across every new feature.

Repo is here if you want to dig in: https://github.com/Nano-Collective/get-md
