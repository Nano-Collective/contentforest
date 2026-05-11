---
kind: personal
member: will
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-10T21:59:28.274Z"
model: "minimax-m2.7"
char_count: 1381
---

Running Qwen, Kimi, or GLM with Nanocoder? We just shipped something that should make those open-weights models significantly more usable.

The issue with most AI coding tools is they assume the model produces tool calls in a native format. Open-weights models often don't — they produce plain text containing a JSON description instead. That meant these models were getting pushed into an unsupported path without a clear way to call tools reliably. Until now.

v1.26.0 adds a JSON tool fallback path. The `/tune` menu now cycles through Native ON / OFF (XML) / OFF (JSON). JSON mode embeds tool schemas as literal JSON Schema and adds a parsing branch that extracts and validates JSON tool calls from plain text.

There's also a fix for Ghost Echo — the failure mode where the model echoes tool-call text back into your response after a tool runs. The `stripEmbeddedToolCallText()` function handles that now.

And the parser now handles `<function=...>`, `<function>`, and `<tool_name>` tags alongside everything else.

Available in Nanocoder v1.26.0 — select JSON tool mode via `/tune` or configure in `agents.config.json`.

Very pleased to have this in. Big credit to the team on this one — Brijesh K R, Deniz Okcu, Nassim Amar, Matthew Spence, Alexandru Spînu

https://github.com/Nano-Collective/nanocoder
