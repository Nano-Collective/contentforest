---
kind: x-daily
date: "2026-09-21"
source: "sentinel"
channel: x
angle: "Line range is not part of the identity"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 221
---

4-6 today, 5-5 tomorrow, same issue. Sentinel alpha's dedup hash covers rule, file, and category, and deliberately not the line range. An LLM that drifts through the file still hashes to one tracker entry, not two ghosts.
