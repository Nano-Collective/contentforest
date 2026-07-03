---
kind: x-daily
date: "2026-07-02"
source: "get-md"
channel: x
angle: "Sitemap glob filtering"
generated_at: "2026-07-02T09:47:54.295Z"
model: "minimax-m3"
char_count: 273
distributed_at: "2026-07-03T13:40:57.694Z"
---

50,000 files from one sitemap crawl is not a win. `getmd --sitemap <url> --include '/docs/**'` keeps what you want; both flags repeat. Gotcha: `--exclude` runs after `--include`, so you subtract from what include chose. Clean markdown for the URLs you actually cared about.
