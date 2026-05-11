---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:01:16.016Z"
model: "minimax-m2.7"
char_count: 0
---

The first version of a feature rarely captures the full problem. It captures the obvious cases. The interesting ones appear under real usage.

Reasoning traces were released in a previous version. The release note was a one-liner. What the one-liner did not capture was the engineering that followed once the feature was running against real models in real conversations.

Three things broke. Each one is instructive.

**Control+R did not restore reasoning on follow-up turns.** After toggling expansion off and on, the reasoning from the previous turn was gone. The fix: persist reasoning on `assistantMsg` so it survives in history, and re-render from stored state rather than from the raw stream. This was not obvious at design time — the feature was tested primarily in single-turn sessions, not in multi-turn conversations where a user might toggle expansion mid-way through.

**Codex GPT-5 reasoning did not render.** The API default for `reasoningSummary` was not set, so GPT-5's reasoning effort was zeroed out by default. The model was producing reasoning; the tool was not reading it. This is a pattern I have seen across multiple AI SDK integrations: API defaults that are not the defaults the provider actually uses. The fix is to set the parameters explicitly rather than relying on SDK defaults.

**Ghost Echo on the reasoning path.** `<think>` content was not stripped on the native tool-calling path, so reasoning leaked into the rendered output. The same failure mode that affects JSON tool fallback, applied to a different parsing path.

The pattern is the same in each case: a system that works in the common case and fails in the specific one. The answer is to build the system to handle the specific case explicitly, not to assume the common case covers everything.

Mind & Machine covers the reasoning trace engineering in more depth.

https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728