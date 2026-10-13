---
kind: x-daily
date: "2026-10-12"
source: "get-md"
channel: x
angle: "parseSitemapXml handles both shapes of feed"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 237
---

You already have the XML in hand. Branch on <urlset> vs <sitemapindex>, or trust the parser? You do not have to. get-md's parseSitemapXml inspects the root and returns `{ type, entries }` either way, so one code path handles both shapes.