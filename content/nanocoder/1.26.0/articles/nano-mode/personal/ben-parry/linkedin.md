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

A 1B model with a 4096-token context window is not a weak machine. It is a constrained one. The constraint is not the model's capability — it is the available space for the model to work in.

Most AI coding tools are built for the other end of the hardware spectrum. Their system prompts run 500, 700 tokens. Add a conversation history, a codebase, and a task, and the model is reading system text before it reads anything useful. On a small local model, this is the difference between a tool that fits and one that does not.

The architectural answer is not to make the model smarter. It is to make the system prompt smaller.

Nano mode drops the system prompt from roughly 500-700 tokens down to 150-250. It removes three tools (`find_files`, `list_directory`, `agent`) — the ones that make most sense when a model has headroom. It compresses the guidance sections to four lines each. It replaces the verbose `SYSTEM INFORMATION` block with a single-line note.

The result is not a general-purpose improvement. It is a trade-off: you give up tool richness and prompt guidance in exchange for lower overhead. That trade-off makes sense when your hardware is the constraint.

There is a pattern here that applies beyond AI tooling. Any system that serves a wide range of hardware profiles has to make this choice somewhere. Either you optimise for the median user and penalise the low end, or you build a mode that serves the low end and let the median user decide whether they need the extra support.

The right answer is usually the second one. Let the person with headroom opt in to the fuller prompt; let the person without headroom opt out of the parts they do not need.

Mind & Machine covers the architectural decisions behind this in more depth.

https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728