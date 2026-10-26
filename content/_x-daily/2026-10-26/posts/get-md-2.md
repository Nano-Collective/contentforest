---
kind: x-daily
date: "2026-10-26"
source: "get-md"
channel: x
angle: "A thousand pages, one line each"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 264
---

1000 pages does not mean 1000 files in memory.

`get-md --batch urls.txt --json` writes one self-contained JSON object per line. Each page is a complete record the moment it lands, so it streams into jq or a JSON database mid-crawl. You never hold the whole batch.
