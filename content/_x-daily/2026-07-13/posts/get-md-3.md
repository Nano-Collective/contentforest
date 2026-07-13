---
kind: x-daily
date: "2026-07-13"
source: "get-md"
channel: x
angle: "Runs in React Native, no JSDOM"
generated_at: "2026-07-13T04:03:10.082Z"
model: "minimax-m3"
char_count: 262
---

DOM parsers assume a browser. JSDOM assumes Node. Mobile apps get a fork.

get-md ships against happy-dom-without-node instead, so the same convertToMarkdown() runs in Node, in a React Native app, and in the browser. One call, three runtimes, no platform branch.