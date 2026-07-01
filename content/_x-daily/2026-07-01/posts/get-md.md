---
kind: x-daily
date: "2026-07-01"
source: "get-md"
channel: x
angle: "regex by default, LLM by opt-in"
generated_at: "2026-07-01T04:52:12.745Z"
model: "minimax-m3"
char_count: 238
---

Most HTML-to-markdown libraries put you on the LLM path by default. You pay tokens for a page that didn't need them.

get-md ships Turndown regex out of the box. Sub-100ms, no model, no key. `useLLM: true` is the upgrade, not the default.