---
kind: x-daily
date: "2026-06-19"
source: "get-md"
channel: x
angle: "Stream JSONL from a batch run"
generated_at: "2026-06-19T05:22:36.439Z"
model: "minimax-m3"
char_count: 243
---

getmd --batch urls.txt --json streams one JSON object per line, so the output pipes straight into jq or a vector store without buffering the whole batch. Composes with --sitemap, --use-llm, and --cache.

https://github.com/Nano-Collective/get-md
