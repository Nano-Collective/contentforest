---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: get-md
version: "1.5.0"
generated_at: "2026-05-26T22:37:51.060Z"
model: "minimax-m3"
char_count: 4320
---

Every tool makes a bet about the world and locks it in. The question isn't whether a tool makes those bets. It's whether you can change them when the bet turns out to be wrong.

Most AI content tools bet on a specific model, a specific workflow, a specific output format, and make it very hard to change any of those things. You work around the tool. Or you abandon it.

get-md v1.5.0 bets on composability: that the useful thing isn't a tool that works one way, but a tool whose internal parts are visible and interchangeable.

## The pluggable LLM backend

Before v1.5.0, `useLLM: true` meant "use ReaderLM-v2, locally." That was fine when local models were the right call. When people wanted to use their own API keys, their own providers, the workaround was to patch the source, maintain a fork, or rebuild the conversion logic entirely.

The new architecture routes LLM calls through a `sdkProvider` interface. The same shape that [Nanotune](https://github.com/Nano-Collective/nanotune) and [Nanocoder](https://github.com/Nano-Collective/nanocoder) already use. One config pattern covers the whole Nano Collective stack.

Supported providers include `openai-compatible` (Ollama, OpenRouter, Together, Groq, LM Studio, OpenAI, vLLM), `anthropic`, `google`, and `local-llama` as the default. Provider packages are optional peer dependencies. If you try to use a provider you haven't installed, the error tells you which package to install. Not a cryptic module failure.

Config files accept `${ENV_VAR}` substitution so API keys don't end up in committed files. CLI flags cover the same ground. Run `--show-config` to inspect your current setup, with keys redacted in the output.

A provider interface rather than a flag was the deliberate choice. A flag locks you into "which model" without answering "which provider, which base URL, which auth mechanism." A provider interface handles all of those questions in one clean abstraction. Switch the provider string and the base URL, and nothing else in your pipeline needs to change.

## Batch mode and the async iterator pattern

`convertBatch` is an async iterator. That distinction matters.

`convertBatchAll(urls, { concurrency: 5 })` gives you an array of results. Familiar. But `convertBatch` itself yields results as they complete, so your pipeline doesn't block waiting for the slowest URL in the batch. For a 10,000-URL crawl, that difference is real.

The concurrency parameter bounds how many requests are in flight simultaneously. With bounded concurrency, you can run a large batch against a rate-limited API without hammering it.

The CLI batch mode reads a file of URLs (one per line, `#` comments stripped), writes one `.md` per URL to an output directory, and produces a JSON manifest. You can tune concurrency, error handling, naming patterns, and JSONL output from the command line.

## Sitemap crawling

`parseSitemap` fetches a sitemap URL, follows `<sitemapindex>` entries recursively, and returns a flat list of discovered URLs. `convertSitemap` composes that with the batch converter for a complete crawl-and-convert pipeline.

CLI flags (`--sitemap`, `--include`, `--exclude`, `--max-depth`, `--max-urls`) make it a one-liner to crawl a specific section of a site. Glob patterns give you the expressive power to be precise without writing a separate script.

## RAG helpers

`chunkMarkdown(md, { maxTokens, overlap, includeHeadingPath })` splits markdown at heading boundaries. Headings exist for a reason. A chunk that starts mid-section without its context is worse than no chunk at all. The heading-aware greedy pack preserves that structure. Continuation chunks carry the full heading path from root to their parent heading, so each chunk knows where it came from, not just what it says.

`estimateTokens` is a chars/4 heuristic. Not a precise measurement. A budgeting tool. For context window planning, you need to know whether you're over or under before you ship. It also surfaces automatically on `ConversionStats.estimatedTokens` for every single-URL conversion.

Both are standalone exports, not tied to the conversion pipeline. You can use them on any markdown string.

## Image localisation

`downloadImages: '<dir>'` on `convertToMarkdown` downloads referenced images in parallel, rewrites their `src` to local paths, and keeps going if a single image fails. URL deduplication means a shared image referenced across ten pages is fetched once.

The CLI mirrors this with `--download-images <dir>`. When the positional input is a URL, the CLI sets that URL as the implicit `baseUrl`, so relative image refs work without a separate flag. The HTML cleaner preserves lazy-load attributes across Wikipedia, Medium, Substack, and similar platforms.

## HTTP reliability

Retries are now built in. The converter retries on network errors, 5xx responses, and 429 rate-limit responses with exponential backoff and up to 25% jitter. On 429, it reads the `Retry-After` header and respects it. Both the seconds form and HTTP-date.

An opt-in filesystem cache skips the network on cache hits. TTL is configurable per-call. Cache failures fall back to a live fetch rather than throwing. The cache is always non-blocking.

`maxBytes` (default 10MB) caps what the fetcher accepts. If a server misrepresents `Content-Length`, the stream aborts mid-flight before unbounded buffering can occur.

These layers compose: cache hits never hit the network. Cache misses trigger the retry logic. Retries honour rate limits. Unbounded responses never reach the buffer.

## What this adds up to

The feature list is long: pluggable LLM, batch, sitemap, RAG helpers, image localisation, HTTP reliability, twelve bug fixes, 528 tests. But the architectural principle is simple. Each capability is built as a composable piece rather than a one-off feature.

If you need batch conversion without the LLM path, that works. If you need the sitemap crawler with glob filtering but no images, that works too.

Composing these pieces is the actual product. Not any one feature.

If you're building on get-md or evaluating it for a pipeline, the [Nanocollective repo](https://nanocollective.org) has the full picture. Mind and Machine will continue tracking what's coming next.