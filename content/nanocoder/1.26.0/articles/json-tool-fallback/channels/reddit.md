---
product: nanocoder
version: "1.26.0"
channel: reddit
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
wont_use_at: "2026-05-20T12:19:30.288Z"
---

Wanted to flag the JSON tool fallback that landed in v1.26.0 — it is a real improvement if you run Qwen, Kimi, or GLM through Nanocoder.

The background: most Nanocoder tool-calling infrastructure assumed the model would emit native tool calls or XML. Many open-weights models do neither — they produce plain text with a JSON description of what they want to do. There was no supported way to handle that in Nanocoder before this release. People were trying to force XML through prompting, which worked badly — models trained without tool-calling in mind tended to produce malformed output, get stuck, or echo the tool-call text back into the response (what the team calls Ghost Echo).

The fix: a new JSON mode in `/tune` (cycle through: Native ON / OFF (XML) / OFF (JSON)). When JSON mode is active, `formatToolsForJSONPrompt()` embeds tool schemas as literal JSON Schema and the tool-call parser gets a JSON extraction branch. `stripEmbeddedToolCallText()` handles Ghost Echo by stripping any echoed tool-call text from the rendered response.

Also: the `<function=...>` format (OpenAI-style function tags) is now handled in the parser, for models that emit that format instead of XML or JSON.

This does not make a 1B model call tools perfectly — the format change does not compensate for parameter quality. But it removes the blocker: there was no supported path, and now there is.

https://github.com/Nano-Collective/nanocoder