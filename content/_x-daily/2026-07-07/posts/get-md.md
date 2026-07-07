---
kind: x-daily
date: "2026-07-07"
source: "get-md"
channel: x
angle: "Whole site to markdown in one command"
generated_at: "2026-07-07T04:14:58.542Z"
model: "minimax-m3"
char_count: 247
---

Feeding raw HTML to an LLM burns context on nav, ads and boilerplate. `getmd --sitemap <url> -o ./out/` walks the sitemap, honours `--include`/`--exclude` globs, caps at 10k URLs, and writes one clean .md per page. One line, whole site, LLM-ready.
