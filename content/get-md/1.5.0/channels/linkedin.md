---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

get-md v1.5.0 is out. This is the biggest release since v1.0, and it makes the tool significantly more useful as a pipeline building block alongside being a solid CLI converter.

**What is new:**

The LLM backend is now pluggable. `useLLM: true` routes through OpenAI-compatible providers, Anthropic, Google, or a local llama model, using the same `sdkProvider` shape as Nanocoder and Nanotune. Existing setups keep working unchanged because `local-llama` is the new default. Provider packages are optional peer dependencies, so you install only what you actually use.

Batch mode ships as `convertBatch()` and `convertBatchAll()`, with a CLI that reads a URL list from a file, writes one `.md` per URL, and emits JSONL for streaming into `jq`. Concurrency is bounded (default 5) and failures are non-fatal by default.

Sitemap crawling: `parseSitemap()` recursively follows `<sitemapindex>` entries and returns a flat URL list. `convertSitemap()` runs the full pipeline. The CLI accepts glob filters for include/exclude, a max-depth cap (default 3), and a max-urls cap (default 10000).

Image localization: `--download-images <dir>` pulls referenced images in parallel, rewrites markdown `src` to local paths, deduplicates by SHA256 prefix, and handles lazy-loaded images (Wikipedia, Medium, Substack, and most blog platforms). Per-image failures log a warning but never fail the conversion.

HTTP cache and retry: exponential backoff on 5xx, 429, and network errors, with `Retry-After` header support. File-system cache is opt-in and best-effort (cache failures fall back to live fetch, never throw).

Plus a sweep of bug fixes from a full review of the v1.4.x surface, and 528 passing tests (up from 405).

**Upgrade notes:** the default LLM behaviour is unchanged. If you were using `node-llama-cpp` directly, nothing changes for you.

If you run into any issues or want to discuss how you are using get-md, the conversation is open on the repo.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

More at https://github.com/Nano-Collective/get-md