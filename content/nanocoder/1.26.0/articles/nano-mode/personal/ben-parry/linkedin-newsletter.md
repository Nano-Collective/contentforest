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

A 1B model with a 4096-token context window is not a weak machine. It is a constrained one. The constraint is not the model's capability - it is the available space for the model to work in before it gets to the actual task.

Most AI coding tools are built for the other end of the hardware spectrum. Their system prompts run 500, 700 tokens. Add a conversation history, a codebase reference, and a task, and the model is reading system text before it reads anything useful. On a small local model, this is the difference between a tool that fits and one that does not.

The question was whether to make the model smarter or make the system prompt smaller. Making the model smarter is not something a tool can do. Making the system prompt smaller is.

Nano mode is a new tool profile under `/tune`. It drops the system prompt from roughly 500-700 tokens down to 150-250. Three specific changes make this work.

**Tools removed.** `find_files`, `list_directory`, and `agent` are gone. These are the tools that make most sense when a model has headroom to explore - the ones that let it find files, read directories, and spawn subagents. They are less useful when every token counts.

**Prompt sections compressed.** `CORE PRINCIPLES` and `CODING PRACTICES` are dropped entirely. `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` are capped at four lines each. The verbose `SYSTEM INFORMATION` block becomes a single-line `## SYSTEM` note. The overall prompt shape stays the same - it is still a valid system prompt - but the surface area is smaller.

**AGENTS.md excluded by default.** An opt-in toggle lets users add it back if their setup handles it. Some users want the project-specific context from AGENTS.md even when running a small model. The toggle respects that.

The result in practice: a 1B model with a 4096-token window now has more usable space. A 3B model on a constrained GPU goes from "this barely fits" to "this fits." The trade-off is explicit - you give up tool richness and prompt guidance in exchange for lower overhead. That trade-off is not universally correct; it is correct when your hardware is the constraint. When it is not, the minimal or full profile is the better choice.

The architectural principle: systems that serve a wide range of hardware profiles need to make this decision somewhere. Either you optimise for the median and penalise the low end, or you build modes that serve the low end and let the median user decide. Nano mode is the second approach - a system that adapts its surface area to the hardware available, rather than asking every user to adapt to the same surface area.

What nano mode does not change: tool-call behaviour, context window management, auto-compact, or token budgeting. Those operate at the session layer. If you are hitting context limits with nano mode, the issue is the conversation length, not the system prompt. The usual tools - auto-compact, manual `/compact`, or `/clear` - still apply.

What is coming: monitoring how the 150-250 token range performs across tune profiles (normal, auto-accept, plan, scheduler) and whether the AGENTS.md toggle produces meaningful differences in output quality for models that can handle it.

The prompt sections are in `source/app/prompts/sections/` alongside the full ones. Each is authored to be self-contained, assuming the model already has the general context that the full sections provide. If you want to see what the prompt looks like without running the model, `pnpm run generate-system-prompts` produces a snapshot of every variant - the same script used for offline token counting during development.

https://nanocollective.org