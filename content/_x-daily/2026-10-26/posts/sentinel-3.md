---
kind: x-daily
date: "2026-10-26"
source: "sentinel"
channel: x
angle: "Severity weighting is not advisory"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 277
---

A pack that says "critical" is not asking nicely. In Sentinel (alpha), a key under `severity_weighting` gets that severity on the finding and the issue, whatever the model answered. It cuts down too, so an inflated critical is capped. Rules you leave out keep the model's call.
