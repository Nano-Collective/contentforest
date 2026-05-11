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

The first version of a feature rarely captures the full problem. It captures the obvious cases. The interesting ones appear under real usage.

Reasoning traces were released in a previous version. The release note was a one-liner. What the one-liner did not capture was the engineering that followed once the feature was running against real models in real conversations.

Three things broke.

**Control+R did not restore reasoning on follow-up turns.** After toggling expansion off and on, the reasoning from the previous turn was not re-rendered. The feature was tested primarily in single-turn sessions. Multi-turn conversations where a user toggles expansion mid-way through were not the primary test scenario. The fix: persist reasoning on `assistantMsg` so it survives in history, and re-render from stored state rather than from the raw stream.

**Codex GPT-5 reasoning did not render.** The API default for `reasoningSummary` was not set, so GPT-5's reasoning effort was zeroed out by default. The model was producing reasoning; the tool was not reading it. This is a recurring pattern in AI SDK integrations: API defaults that are not the defaults the provider actually uses. The fix is to set the parameters explicitly rather than relying on SDK defaults - `reasoningSummary=auto` and `reasoningEffort=medium` in the AI SDK options.

**Ghost Echo on the reasoning path.** `<think>` content was not stripped on the native tool-calling path, so reasoning leaked into the rendered output. The same failure mode that applies to JSON tool fallback, applied to a different parsing path. The fix: strip `<think>` tags on the native path. On the XML path, malformed-XML retries are now capped to prevent an out-of-memory condition if a model gets stuck emitting broken tool-call XML.

The pattern is the same in each case: a system that works in the common case and fails in the specific one. Building the system to handle the specific case explicitly - rather than assuming the common case covers everything - is where most of the post-release engineering lived.

The UI has three control points. `Control+R` toggles expansion live - for both the initial response and for follow-up reasoning on subsequent turns. Display Settings (`/settings` -> "Tool Results and Thinking") sets the default expansion state. When "Show Thinking by default" is off, reasoning is collapsed by default. The tune menu `expandedReasoning` option provides a per-session override. These three surfaces are designed to be independent so users can set a default and override it per session without losing their preference.

What reasoning traces do not do: they are not a performance indicator. Seeing the model's reasoning does not tell you whether the model is correct - it tells you what the model was thinking when it arrived at its answer. That is useful for debugging. It is not useful for evaluation. A model that produces long, confident reasoning can still be wrong.

They also do not change the tool-calling behaviour. Reasoning is separate from tool calls. A model that produces reasoning traces still calls tools in the same way it would without them.

The next iteration is focused on making the rendering pipeline more robust across model types. Reasoning output formats vary more than expected, and the current rendering approach assumes a consistency that does not exist across all reasoning model providers.

The stream arrives as two content types interleaved: the reasoning content and the final response. The UI has to render both without the reasoning flashing in and out as the model writes over it. The approach is to buffer the reasoning content, render it in the Thought block, and let it persist in history once complete. That works for most providers; the iteration is handling the edge cases where it does not.

https://nanocollective.org