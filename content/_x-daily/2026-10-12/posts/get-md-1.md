---
kind: x-daily
date: "2026-10-12"
source: "get-md"
channel: x
angle: "Sitemap crawl has a 10000 URL cap by default"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 234
---

A misconfigured include glob shouldn't drain a week's LLM budget. get-md's sitemap walker caps at 10,000 URLs by default and stops collecting when it hits the cap, so a bad pattern fails fast instead of exhausting memory or API spend.
