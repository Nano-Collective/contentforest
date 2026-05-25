---
product: nanocoder
version: "1.26.0"
channel: github-discussion
title: "Reasoning traces: streaming, rendering, and the fixes after first release"
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
wont_use_at: "2026-05-20T12:19:46.033Z"
---

Nanocoder v1.26.0 streams reasoning content from models that emit it — DeepSeek-R1-style, Anthropic extended thinking, Codex GPT-5 with `reasoningSummary=auto`, and similar. The feature is not new to this release, but the release notes only surface the headline. The engineering behind it had several rounds of iteration that are worth documenting.

## What reasoning traces are in this context

Large reasoning models emit intermediate steps before producing a final response. Those steps are not part of the user-facing answer — they are the model's scratch space, usually hidden. When a tool surfaces them, you see them as a collapsible **Thought** block above the response. They persist in conversation history and appear in logs.

Nanocoder renders them in real time as the model streams them, rather than waiting for the model to finish. This required changes to the streaming pipeline: the UI had to handle interleaved content (reasoning first, then response) without janky rendering or data races.

## What the first implementation got wrong

The initial reasoning trace implementation had a set of interacting problems documented across a handful of issues:

**`Control+R` did not restore reasoning content on follow-up turns.** After toggling expansion off and on, the reasoning from the previous turn was not re-rendered. The fix: persist reasoning on `assistantMsg` so it survives in history, and re-render on `Control+R` from the stored state rather than trying to re-derive it from the raw stream.

**Codex GPT-5 reasoning did not render.** The API default for `reasoningSummary` was not set, so GPT-5's reasoning effort was zeroed out by default. The fix: explicitly set `reasoningSummary=auto` and `reasoningEffort=medium` in the AI SDK options, so Codex reasoning actually appears.

**Reasoning trace follow-ups lost state.** A subsequent prompt about the same reasoning (the model referring back to its own thought process) required reasoning to survive across conversation turns. The fix: after the loop, `flushBuffer` is invoked as a safety net, and reasoning content is stored on `assistantMsg` so it survives in history.

**System prompt cache race.** During subagent startup, "No subagents available." was cached before the subagent loader finished, which could suppress reasoning for the main session's first response after a subagent launch. The fix: cache invalidation tied to the subagent loader's ready signal.

**Ghost Echo on the reasoning path.** `<think>` content was not stripped on the native tool-calling path, so reasoning could leak into rendered output. The fix: strip `<think>` tags on the native path. On the XML path, malformed-XML retries are now capped to prevent OOM if a model gets stuck emitting broken tool-call XML.

## The rendering surface

The reasoning trace UI has three control points:

`Control+R` — toggles expansion of the current reasoning block. Works for both the initial response and for follow-up reasoning on subsequent turns.

**Display Settings panel** (`/settings` → "Tool Results and Thinking") — sets the default expansion state. When "Show Thinking by default" is off, reasoning is collapsed by default. This is persisted to `nanocoder-preferences.json`.

**Tune menu `expandedReasoning` option** — sets per-session expansion state, overriding the default. Useful if you want reasoning visible for one session but collapsed by default.

## The data flow

The stream arrives as two content types interleaved: the reasoning content and the final response. The UI has to render both without the reasoning flashing in and out as the model writes over it. The approach taken: buffer the reasoning content, render it in the Thought block, and let it persist in history once complete.

The `parseToolCalls()` function runs against text content when the SDK reports no `tool_calls`, as a secondary parsing path. This catches the case where a model that normally emits native tool calls falls back to text mid-stream.

## What reasoning traces do not do

They are not a performance indicator or a benchmark. Seeing the model's reasoning does not tell you whether the model is correct — it tells you what the model was thinking when it got to its answer, which is useful for debugging but not for evaluation. A model that produces long, confident reasoning can still be wrong.

They also do not change the tool-calling behaviour. Reasoning is separate from tool calls. A model that produces reasoning traces still calls tools in the same way it would without them.

https://github.com/Nano-Collective/nanocoder