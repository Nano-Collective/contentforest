---
product: nanocoder
version: "1.26.0"
channel: linkedin
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
wont_use_at: "2026-05-20T12:19:27.213Z"
---

Running Qwen, Kimi, or GLM with Nanocoder? v1.26.0 adds a JSON tool fallback path specifically for open-weights models that do not emit native tool calls.

The issue: most AI coding tools assume the model produces tool calls in a native format (OpenAI `tool_calls`, Anthropic blocking tool use, etc.). Open-weights models often produce plain text containing a JSON description instead. That left these models without a supported path to use tools reliably in Nanocoder — until now.

The `/tune` menu now cycles through Native ON / OFF (XML) / OFF (JSON). JSON mode embeds tool schemas as literal JSON Schema and adds a parsing branch to the tool-call parser that extracts and validates JSON tool calls from plain text. It also adds `stripEmbeddedToolCallText()` to prevent Ghost Echo — the failure mode where the model echoes tool-call text back into the user-visible response after a tool runs.

The `<function=...>` format (OpenAI-style function tags) is also now handled in the parser, alongside `<function>` and `<tool_name>` tags.

Available in v1.26.0 — select JSON tool mode via `/tune` or configure in `agents.config.json`.

https://github.com/Nano-Collective/nanocoder