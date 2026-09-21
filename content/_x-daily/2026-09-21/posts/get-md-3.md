---
kind: x-daily
date: "2026-09-21"
source: "get-md"
channel: x
angle: "Recover mermaid from rendered svgs"
generated_at: "2026-09-21T04:58:49.308Z"
model: "minimax-m3"
char_count: 279
---

You fetched the docs page and every diagram came back as flat text. get-md's recoverMermaid pass hunts the source first: sibling scripts, data-code on the wrapper, hidden templates. Only when none of those exist does it fall back to SVG accessibility text, behind a strict guard.
