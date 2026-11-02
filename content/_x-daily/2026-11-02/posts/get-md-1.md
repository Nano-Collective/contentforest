---
kind: x-daily
date: "2026-11-02"
source: "get-md"
channel: x
angle: "Mermaid recovered from rendered SVG"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 277
---

A page shipping only rendered SVG doesn't have to lose the diagram. get-md reads the source from the SVG's own <desc>, <title> or aria-label, so you get a Mermaid fence instead of loose labels. The check is strict, so mermaid.js's "Created with Mermaid" never passes as source.
