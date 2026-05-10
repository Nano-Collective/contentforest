---
product: nanocoder
version: "1.26.0"
channel: reddit
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
---

The reasoning trace feature in v1.26.0 gets a one-line mention in the release notes, but it shipped after a non-trivial set of fixes. Here is what was wrong and what changed.

The headline: Nanocoder now streams reasoning content from models that emit it (DeepSeek-R1-style, Anthropic extended thinking, Codex GPT-5 with `reasoningSummary=auto`). The reasoning renders as a collapsible Thought block above the response, persists in history, and appears in logs.

What the release notes do not cover:

**Control+R did not restore reasoning on follow-up turns.** The initial implementation did not persist reasoning in history — it only existed in the live stream. Toggle expansion off and on, and the reasoning from earlier turns was gone. Fixed by storing reasoning on `assistantMsg`.

**Codex GPT-5 reasoning did not render at all.** The AI SDK defaults for GPT-5 reasoning effort were not set, so the API was emitting nothing by default. Fixed by explicitly setting `reasoningSummary=auto` and `reasoningEffort=medium` in the SDK options.

**Reasoning trace follow-ups lost state.** A model referring back to its own earlier reasoning required the reasoning to survive across conversation turns. Fixed by persisting reasoning on `assistantMsg` and adding a `flushBuffer` safety net after the loop.

**Ghost Echo on the reasoning path.** `<think>` tags were not stripped on the native tool-calling path, so reasoning leaked into the rendered output. Fixed by stripping `<think>` on the native path.

Three ways to control it: `Control+R` toggles live. Display Settings (`/settings` → "Tool Results and Thinking") sets the default, persisted to `nanocoder-preferences.json`. Tune menu `expandedReasoning` sets a per-session override.

The feature does not make reasoning models more accurate — it makes their reasoning visible, which is useful for debugging and for understanding where the model went wrong. A model that produces confident long reasoning can still be wrong.

https://github.com/Nano-Collective/nanocoder