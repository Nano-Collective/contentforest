---
kind: x-daily
date: "2026-10-19"
source: "get-md"
channel: x
angle: "useLLM-defaults-to-local-reader-lm"
generated_at: "2026-10-19T04:43:25.939Z"
model: "minimax-m3"
char_count: 267
---

Most AI tooling asks for an API key before it does anything useful. `get-md` doesn't. `useLLM: true` defaults to a local 1.12 GB ReaderLM-v2 model under `~/.get-md/models/`, no key, no signup. Hosted backends live in an `llm` config block when you actually want them.