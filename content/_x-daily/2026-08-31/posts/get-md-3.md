---
kind: x-daily
date: "2026-08-31"
source: "get-md"
channel: x
angle: "React Native runs the same code"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 268
---

Most "browser HTML to Markdown" libs hit a wall the moment you ship to a phone. `get-md` swaps JSDOM for `happy-dom-without-node`, so the same `convertToMarkdown` call runs in a React Native bundle. HTML in, clean Markdown out, on-device - no Node service in the loop.
