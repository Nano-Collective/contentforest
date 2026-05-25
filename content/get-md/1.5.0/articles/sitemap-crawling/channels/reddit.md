---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

v1.5.0 adds `--sitemap <url>` to the get-md CLI for converting an entire site from its sitemap. The feature is two functions at the API level: `parseSitemap()` returns a flat URL list, and `convertSitemap()` runs the full pipeline from sitemap to markdown.

`parseSitemap()` resolves nested sitemapindexes recursively. If the input URL is a sitemap index, it fetches each child sitemap until it has all the page URLs. `--max-depth` (default 3) caps how deep that recursion goes. `--max-urls` (default 10000) caps the total count before conversion starts.

`--include` and `--exclude` are the filter flags. Both are repeatable. The glob behaviour is: `*` matches within a single path segment (no slashes), `**` matches anything. `--include` runs first, `--exclude` second. If you supply any includes at all, a URL needs to match at least one before the exclude logic runs.

One thing the announcement covered but this is worth calling out separately: `convertSitemap()` is not a general web crawler. Links inferred from page HTML are not followed. Pages absent from the sitemap are not reached. That is a deliberate design constraint — it keeps the feature scoped to what sitemaps guarantee, and it means you are not writing the kind of politeness and rate-limit logic that belongs in a crawler.

Docs are at docs.nanocollective.org with a full guide and API reference.

https://github.com/Nano-Collective/get-md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
