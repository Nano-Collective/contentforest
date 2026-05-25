---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

v1.5.0 adds two CLI flags for site-wide conversion via sitemap. `--sitemap <url>` feeds a sitemap through `parseSitemap()` and `convertBatch()` in one call. `--include` and `--exclude` are repeatable glob filters for narrowing the URL list before conversion starts. `--max-depth` caps recursion into nested sitemapindexes (default 3). `--max-urls` caps total URLs at 10000.

The glob syntax is the part worth knowing. `*` matches within a single path segment; it does not cross slashes. `**` matches anything including slashes. Include filters run before exclude ones.

The other thing worth knowing: `convertSitemap()` is not a general web crawler. If a page is not in the sitemap, it does not get reached. This is the tradeoff that makes the feature predictable and keeps it scoped to what get-md is.

Everything is in the new sitemap guide at docs.nanocollective.org, with a full CLI option reference.

The repo: https://github.com/Nano-Collective/get-md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
