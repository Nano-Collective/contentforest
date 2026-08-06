---
kind: x-daily
date: "2026-07-27"
source: "sentinel"
channel: x
angle: "Severity is a four-tier scale with confidence"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 238
distributed_at: "2026-08-06T13:39:37.997Z"
---

Four tiers, not three. Sentinel rates findings low, medium, high, critical, with confidence on a separate axis. A high-confidence "low" and a low-confidence "critical" both exist, and the gap between them is exactly where bad alerts live.