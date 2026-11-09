---
kind: x-daily
date: "2026-11-09"
source: "get-md"
channel: x
angle: "Four ways to handle a diagram"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 277
---

Most pages do not ship a diagram. They ship the SVG the browser drew, and the structure is gone.

get-md can recover a Mermaid fence from that SVG, but only if the source is in the DOM. No source, no fence: labels fall through as loose text. You keep the names, lose the graph.
