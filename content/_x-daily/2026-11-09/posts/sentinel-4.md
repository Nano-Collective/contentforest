---
kind: x-daily
date: "2026-11-09"
source: "sentinel"
channel: x
angle: "Confidence is not severity"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 271
---

A finding's severity says how bad it is. Confidence says how sure you are. Collapse them and a shaky `high` looks like a proven one.

So confidence belongs in the pack, not inferred from the label. Sentinel (alpha) asks the model to file low confidence rather than guess.
