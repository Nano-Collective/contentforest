---
product: nanocoder
version: "1.26.0"
channel: github-discussion
title: "JSON tool calling for open-weights models: how it works"
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.26.0 adds a JSON tool fallback path for open-weights models that do not emit native tool calls. This matters for Qwen, Kimi, and GLM users who want to run Nanocoder with models that produce structured JSON tool calls rather than the XML or native tool-call formats the SDK normally expects.

## The problem with non-tool-calling models

Most AI coding tools assume the model emits tool calls natively — via OpenAI's `tool_calls` format, Anthropic's blocking tool use, or a provider-specific equivalent. That assumption holds for frontier models. It does not hold for many open-weights models, which often produce plain text that contains a JSON description of the tool they want to call.

The previous workaround was to prompt-engineer the model into producing XML tags. That works, but it is brittle — models trained without tool-calling in mind tend to produce malformed output, get stuck in loops, or echo tool-call text back into the user-visible response.

## The new tune menu option

The `/tune` menu now cycles through three tool-calling modes:

- **Native ON** — use native tool calling if the provider supports it.
- **OFF (XML)** — force XML format for models that handle it.
- **OFF (JSON)** — force JSON format for models that do not emit tool calls natively.

The JSON path was the gap. It was not previously available as a separate mode, which left models like Qwen, Kimi, and GLM in an awkward position: they needed a tool-calling format but had no dedicated option for it.

## How JSON tool calling works in this context

When JSON mode is active, `formatToolsForJSONPrompt()` embeds the tool schemas as literal JSON Schema alongside a prompt instruction directing the model to output a JSON object with `tool` and `input` fields. The tool-call parser then looks for that JSON shape in the model's text response.

Two problems had to be solved for this to work reliably:

**JSON branch in the parser.** The tool-call parsing logic previously only handled XML tags and native SDK tool calls. The new code adds a parsing path that extracts a JSON object from plain text and validates it against the expected schema.

**Ghost Echo prevention.** A known failure mode with non-tool-calling models is Ghost Echo — the model echoes the tool-call text back into its rendered response after the tool runs. This pollutes the conversation history and the UI. The fix is `stripEmbeddedToolCallText()`: after a tool runs, the parser is invoked against the response text and any echoed tool-call artifact is removed before the response reaches the UI.

There is also a secondary protection on the native tool-calling path: `stripEmbeddedToolCallText()` runs on responses where the SDK reports no `tool_calls` but the text contains what looks like tool-call output. This catches cases where a model partially emits a tool call before falling back to text.

## The `<function=...>` format

As a related addition, the tool-call parser now handles OpenAI-style `<function=...>` tags in addition to `<function>` and `<tool_name>` tags. Some models emit this format and it was previously unrecognised. This is orthogonal to the JSON fallback but shipped in the same release and addresses the same class of compatibility gap.

## What this does not solve

The JSON fallback gives these models a reliable way to call tools, but it does not improve their tool-calling accuracy beyond what the model is capable of. A 1B model prompted with JSON Schema is not going to produce perfect tool calls — the format change does not compensate for parameter knowledge or instruction-following quality. What it does is remove the previous blocker: there was no supported path for these models to call tools at all, and now there is.

## Configuration

JSON tool fallback is selectable from the `/tune` menu under "Tool Calling Format". It can be set per-session or persisted via `agents.config.json` using the same `disabledTools` / tool profile mechanism that controls other tune options.

https://github.com/Nano-Collective/nanocoder