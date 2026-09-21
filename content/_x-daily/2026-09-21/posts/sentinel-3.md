---
kind: x-daily
date: "2026-09-21"
source: "sentinel"
channel: x
angle: "Dry-run before any issue lands"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 275
---

First Sentinel dispatch files everything above threshold. There's no summary-only warm-up. Before it goes live, trigger dry-run from workflow_dispatch. The preview shows what would file, what dedup catches, what sits under threshold. Tune from that, not from a noisy tracker.
