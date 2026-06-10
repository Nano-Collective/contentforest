---
kind: personal
member: will
channel: linkedin
product: get-md
version: "1.5.0"
generated_at: "2026-05-26T22:37:33.190Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-05-27T12:36:10.343Z"
---

get-md v1.5.0 dropped - and it's the biggest release since v1.0 🔥

Five major additions stacked on top of a full bug sweep. The headline is the LLM backend is now pluggable. You no longer have to be locked into a single provider. Configure whatever you want to use - Ollama, OpenRouter, Together, Groq, Anthropic, Google, or stick with the local-llama default - and get-md routes through it seamlessly.

But it doesn't stop there. Batch mode handles bulk URL conversions with bounded concurrency. Sitemap crawling follows index files and converts entire sites in one go. RAG pipelines get two new helpers - chunkMarkdown for semantic splitting at heading boundaries, and estimateTokens for quick context-window budgeting. Images get downloaded and localised automatically. And the fetch layer is hardened with built-in retry, exponential backoff, and an optional file-system cache.

528 tests. Everything is tested and solid.

This is what it looks like when a community collective builds tooling for the community rather than for profit. The Nano Collective kept its word on open source and privacy-first - and this release is proof of it.

More soon.

Built by the Nano Collective.