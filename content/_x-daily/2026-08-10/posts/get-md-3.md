---
kind: x-daily
date: "2026-08-10"
source: "get-md"
channel: x
angle: "URL into clean Markdown under 100ms"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 266
---

Under 100ms per page, no API key, no rate limit. get-md runs Turndown plus Mozilla Readability locally, so convertToMarkdown() on a URL is a single sync-feeling call. Wire it into a small loop for a long URL list, not a script that round-trips an LLM for every page.
