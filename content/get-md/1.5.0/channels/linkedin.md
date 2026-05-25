---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T22:03:00.677Z"
model: "minimax-m2.7"
char_count: 0
---

get-md v1.5.0 is out. The biggest release since v1.0, with five substantial additions and a full bug sweep.

The headline: the LLM backend is now pluggable. Instead of being hard-wired to local ReaderLM-v2, get-md routes through whichever provider you configure. OpenAI-compatible (Ollama, OpenRouter, Together, Groq, LM Studio), Anthropic, Google, or the local-llama default. One config shape covers the full Nano Collective stack. Env-var substitution in config files keeps API keys out of committed files, and missing peer dependencies surface a clear install message instead of a cryptic module error.

Batch and sitemap modes cover bulk conversion workflows. convertBatch yields per-URL results as they complete, with bounded concurrency. parseSitemap recursively follows sitemapindex entries, and convertSitemap composes that with the batch converter for a complete crawl-and-convert pipeline. CLI-glob filtering (`--include`, `--exclude`) and max-depth caps apply throughout.

For RAG ingestion pipelines, chunkMarkdown splits markdown at heading boundaries with configurable overlap and heading-path tracking. Continuation chunks carry the full path from root to their parent heading. estimateTokens gives a chars/4 heuristic for context budgeting and surfaces on ConversionStats.estimatedTokens for every conversion.

Image localisation downloads referenced images in parallel, rewrites their src to point at local copies, and handles per-image failures gracefully. The CLI now sets an implicit baseUrl when the input is a URL, so relative image refs resolve without a flag. The cleaner preserves lazy-load attributes on img tags for Wikipedia, Medium, Substack, and similar platforms.

HTTP reliability: built-in retry on network errors and 5xx/429 responses with exponential backoff, Honouring Retry-After headers on 429. An opt-in file-system cache skips the network entirely on hits. A maxBytes cap (default 10MB) prevents unbounded buffering from servers that lie about Content-Length.

528 tests, up from 405 at 1.4.1.

Full details: https://github.com/Nano-Collective/get-md

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.
