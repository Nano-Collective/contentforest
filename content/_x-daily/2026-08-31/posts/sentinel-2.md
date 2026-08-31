---
kind: x-daily
date: "2026-08-31"
source: "sentinel"
channel: x
angle: "Line range is not part of the identity"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 233
---

Most dedup keys include line range, so a model that drifts a few lines between runs hashes a different finding and refiles the issue. Sentinel uses rule + file + category instead: stable across runs, so a triaged issue stays triaged.