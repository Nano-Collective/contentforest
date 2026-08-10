---
kind: x-daily
date: "2026-08-10"
source: "get-md"
channel: x
angle: "Four paths for Mermaid"
generated_at: "2026-08-10T02:35:54.441Z"
model: "minimax-m3"
char_count: 254
---

A rendered Mermaid diagram is gone unless the source lives in the DOM. get-md reads it back from the SVG with a strict heuristic, refusing strings like "Created with Mermaid" that mermaid.js writes into a11y nodes. Loose labels are worse than no diagram.