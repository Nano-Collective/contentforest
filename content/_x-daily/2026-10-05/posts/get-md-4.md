---
kind: x-daily
date: "2026-10-05"
source: "get-md"
channel: x
angle: "Cache re-runs hit disk, not the network"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 236
---

1 hour TTL on a per-URL cache means a flaky CI step re-runs in milliseconds, not seconds.

Re-running get-md on the same URL hits `~/.get-md/cache` before the network. A cache miss falls back to a live fetch, so the cache never blocks.