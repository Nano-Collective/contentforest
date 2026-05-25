---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

We shipped get-md v1.5.0. It is the biggest release since v1.0, and it covers five areas that make the tool useful as a pipeline building block, not just a CLI you reach for once.

**Pluggable LLM backend.** `useLLM: true` is no longer hard-wired to local ReaderLM-v2. It now routes through whatever provider you configure: OpenAI-compatible (Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, vLLM), Anthropic, Google, or a local llama model. It uses the same `sdkProvider` shape as Nanocoder and Nanotune, so one config covers the whole Nano Collective stack. Existing setups keep working unchanged because `local-llama` is the default when nothing is set. Provider packages are optional peer dependencies, so you install only the SDK you actually need.

**Batch mode.** `convertBatch(urls, options)` is an async iterator that yields per-URL results as they complete with bounded concurrency. `convertBatchAll(urls, options)` is the Promise convenience that buffers everything. On the CLI, `--batch <file>` reads a URL list (one per line, comments and blanks stripped), `-o <dir>` writes one `.md` per URL, `--json` emits JSONL for streaming into `jq`, and `--manifest` gives you a JSON summary.

**Sitemap crawling.** `parseSitemap(source, options)` fetches a sitemap URL and recursively follows `<sitemapindex>` entries to return a flat URL list. `convertSitemap(sitemapUrl, options)` runs the full pipeline. CLI flags `--include` and `--exclude` are repeatable glob filters, `--max-depth` caps depth (default 3), `--max-urls` caps total URLs (default 10000).

**Image localization.** `--download-images <dir>` pulls referenced images in parallel, rewrites markdown `src` to point at local copies, deduplicates by SHA256 prefix for deterministic filenames, and preserves lazy-load attributes (`data-src`, `data-original`, `srcset`) so Wikipedia, Medium, Substack, and most blog platforms produce real images instead of 1x1 placeholders.

**HTTP cache and retry.** Retries on network errors, 5xx, and 429 with exponential backoff (up to 25% jitter). `Retry-After` headers are honoured in both seconds and HTTP-date form. File-system cache is opt-in and best-effort: cache failures fall back to a live fetch, they never throw.

Plus a full review of the v1.4.x surface produced a cluster of bug fixes, and the test suite went from 405 to 528 passing.

If you hit any issues or want to talk through how you are using get-md, drop an issue on the repo or find us on Discord. We read both.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

More at https://github.com/Nano-Collective/get-md