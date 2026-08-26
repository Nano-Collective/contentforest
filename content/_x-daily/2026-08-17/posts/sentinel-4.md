---
kind: x-daily
date: "2026-08-17"
source: "sentinel"
channel: x
angle: "Close it once, never see it again"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 267
---

Closing an LLM-audit issue because the model misread the code, then finding the same finding re-filed next run. Label the close with sentinel:false-positive. Sentinel reads the label, the finding's stable identity stays in the dedup store, and the issue stays closed.
