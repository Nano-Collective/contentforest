---
kind: x-daily
date: "2026-09-07"
source: "get-md"
channel: x
angle: "useLLM-without-block-reads-local-readerlm"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 262
---

Tools that need an API key to read your file aren't local-first. `get-md` with `useLLM: true` and no `llm` block falls back to a local ReaderLM-v2, so structured-markdown extraction works with no key, no telemetry, no upload. Privacy is a default, not a setting.
