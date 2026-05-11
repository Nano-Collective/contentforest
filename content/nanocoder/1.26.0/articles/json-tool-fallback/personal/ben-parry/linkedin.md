---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:01:16.016Z"
model: "minimax-m2.7"
char_count: 3398
---

Most AI coding tools make a quiet assumption. They assume the model will call tools in a format the system understands — native tool calls, XML, something structured.

That assumption holds for frontier models. It does not hold for many open-weights models, which often produce plain text that happens to contain JSON describing what they want to do.

The question isn't 'do you trust the model?' It's 'does the system make trust unnecessary?'

If a model echoes tool-call text into the response after the tool runs, that is a system failure, not a model failure. The answer is to build the system so the model doesn't need to produce that text in the first place.

Open-weights models like Qwen, Kimi, and GLM couldn't reliably call tools through Nanocoder until v1.26.0. The new JSON tool fallback path embeds tool schemas as JSON Schema and adds a parsing branch that extracts and validates JSON tool calls from plain text.

There is also a secondary protection. `stripEmbeddedToolCallText()` runs on responses where no native tool calls are reported but the text contains what looks like tool-call output. This catches models that partially emit a tool call before falling back to text — a case the primary path misses.

The principle generalises: systems that fail gracefully at format boundaries are more robust than systems that depend on perfect format compliance throughout.

This is the same logic that applies to data pipelines, API contracts, and distributed systems. The boundary is where most failures live, and the answer is usually the same — handle the mismatch explicitly rather than assuming it won't happen.

Mind & Machine covers this in more depth, along with the architectural decisions behind it.

https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728