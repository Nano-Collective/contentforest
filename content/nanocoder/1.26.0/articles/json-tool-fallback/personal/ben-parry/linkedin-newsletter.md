---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:01:16.016Z"
model: "minimax-m2.7"
char_count: 0
---

The problem with open-weights models in AI tooling is not that they cannot code. It is that they do not fit neatly into the tool-calling format assumptions most AI coding tools are built around.

Most tools assume a model will emit tool calls in a structured format - OpenAI `tool_calls`, Anthropic blocking tool use, a provider-specific equivalent. That assumption holds for frontier models. It does not hold for Qwen, Kimi, and GLM, which often produce plain text containing a JSON description of the tool they want to call, rather than a native tool call.

The previous workaround was to prompt-engineer the model into XML. That works, but it is brittle. Models trained without tool-calling in mind tend to produce malformed output, get stuck in loops, or echo tool-call text back into the user-visible response after a tool runs. Ghost Echo - that last failure mode - was not a model problem. It was a system design problem.

The architectural decision was to add a dedicated JSON parsing branch to the tool-call parser. When JSON mode is active, tool schemas are embedded as literal JSON Schema alongside a prompt instruction directing the model to output a JSON object with `tool` and `input` fields. The parser extracts that JSON from plain text and validates it against the expected schema before executing the call.

This approach was chosen because it does not require modifying how the model is prompted or trained. The model produces what it produces; the system adapts to receive it. This is the same principle that applies to API design, distributed systems, and any boundary between two systems that do not control each other: handle the mismatch explicitly rather than assuming format compliance.

There is a secondary problem that the primary path does not catch. When a model that normally emits native tool calls falls back to text mid-stream, no `tool_calls` are reported, and the text goes through unparsed. In some cases, the model echoes the tool-call text back into its response after the tool runs. Without `stripEmbeddedToolCallText()`, conversation history and the rendered output both get polluted by tool-call artifacts that are not part of the actual response. This function runs on the response text after a tool completes, extracts any echoed artifact using the same parsing logic, and removes it before the response reaches the UI.

The broader principle: systems should be designed to fail gracefully at format boundaries rather than to depend on perfect format compliance from models. Different models produce different formats. That variability is not an edge case - it is the operating environment for open-weights tooling.

What this does not do: improve tool-calling accuracy beyond what the model is capable of. A 1B model prompted with JSON Schema will produce consistent tool calls. It will not produce correct ones if the model does not have the knowledge or instruction-following quality to do so. The JSON fallback removes a blocker. It does not compensate for model capability.

The next step is monitoring how non-tool-calling models perform with the JSON fallback in practice. Format consistency and format accuracy are different things, and the data from real usage will determine whether additional validation layers are needed.

One pattern that emerged from the initial testing: models that produce valid JSON on a first call tend to stay consistent across a session, while models that produce malformed output tend to do so repeatedly. This suggests the fallback path could benefit from per-model state tracking - not a persistent preference, but a session-level heuristic that adjusts how aggressively to validate based on what the model has produced so far. The architectural groundwork for that is already in place; the data from real usage will determine whether it is worth building out.

https://nanocollective.org