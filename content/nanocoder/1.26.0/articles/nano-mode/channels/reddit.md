---
product: nanocoder
version: "1.26.0"
channel: reddit
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
---

v1.26.0 shipped nano mode and it is worth knowing about if you run Nanocoder with small local models.

The problem it solves: the system prompt (even in minimal mode) runs 500-700 tokens. On a 1B model with a 4096-token context window, that is a significant chunk gone before the model writes its first line of code. Some setups just could not fit.

Nano mode drops the prompt to ~150-250 tokens. It removes `find_files`, `list_directory`, and `agent` tools; caps the guidance sections at four lines each; and replaces the `SYSTEM INFORMATION` block with a one-line note. `AGENTS.md` is excluded by default (opt back in via the toggle if needed).

The trade-off is explicit: you lose tool breadth and prompt guidance in exchange for lower overhead. If your model has room, use minimal or full. If it does not, nano mode is the option that did not exist before.

There is a "Nano (low-end hardware)" preset that sets the tool profile and trim together. Select it via `/tune` — changes are session-scoped.

Ran it on a 3B Qwen model on a laptop with 8GB RAM and it actually fits now in contexts where it did not before. Not a dramatic change in what the model does, but meaningful for the hardware edge case.

https://github.com/Nano-Collective/nanocoder