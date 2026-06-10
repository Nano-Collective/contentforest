---
product: nanocoder
version: "1.26.0"
channel: linkedin
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m3"
char_count: 0
wont_use_at: "2026-05-20T12:19:38.458Z"
---

Small models on limited hardware have been hitting a wall with Nanocoder — not because the model cannot code, but because the system prompt eats too much of the context window before the model gets to the actual work. v1.26.0 ships nano mode to address that.

Nano mode is a new tool profile under `/tune` that drops the system prompt from ~500-700 tokens (minimal) down to ~150-250 tokens. It removes `find_files`, `list_directory`, and `agent` tools; trims the guidance sections to four lines each; and replaces the verbose `SYSTEM INFORMATION` block with a single-line note.

The result: more room for actual code on small local models. A 1B model with a 4096-token window now has more usable space. A 3B model on a constrained GPU goes from "this barely fits" to "this fits."

The trade-off is real: you give up tool breadth and prompt guidance for lower overhead. Nano mode is for that trade-off, not a general-purpose improvement. If your model has headroom, use minimal or full.

Includes a "Nano (low-end hardware)" preset and an Include AGENTS.md toggle so you can opt back in if your setup handles it.

Available in v1.26.0 — select via `/tune` or configure in `agents.config.json`.

https://github.com/Nano-Collective/nanocoder