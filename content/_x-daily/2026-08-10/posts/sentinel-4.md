---
kind: x-daily
date: "2026-08-10"
source: "sentinel"
channel: x
angle: "Dedup is content hash not line range"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 233
---

An LLM might flag the same issue at lines 4–6 today and 5–5 tomorrow. Sentinel's dedup hash is rule + file + category, not range. The span still shows in the body, but it isn't the finding's identity, so re-audits update, not refile.
