---
kind: x-daily
date: "2026-08-17"
source: "get-md"
channel: x
angle: "Sitemap mode has a hard cap"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 202
---

The default crawl sees a sitemap and recurses forever. get-md shipped the kill switch: --max-urls caps a run at 10,000, --max-depth at 3. Hard limits the "the spec is just a suggestion" default forgets.
