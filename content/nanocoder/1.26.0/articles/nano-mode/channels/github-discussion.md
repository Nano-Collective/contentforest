---
product: nanocoder
version: "1.26.0"
channel: github-discussion
title: "How nano mode works and why we built it"
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
wont_use_at: "2026-05-20T12:19:35.192Z"
---

Nano mode is a new tool profile under `/tune` that drops the system prompt from roughly 500-700 tokens (the minimal profile) down to 150-250 tokens. This is not a cosmetic trim. It is a targeted reduction in what the model has to read on every request, which matters when your hardware is the bottleneck.

## What changed from minimal mode

The minimal profile already removed some tools and shortened some sections. Nano goes further on every axis:

**Tools removed.** `find_files`, `list_directory`, and `agent` are gone. These are the tools that make the most sense when a model has headroom to explore — they are less useful when every token counts.

**Prompt sections compressed.** `CORE PRINCIPLES` and `CODING PRACTICES` are dropped entirely. `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` are capped at four lines each. The verbose `SYSTEM INFORMATION` block becomes a single-line `## SYSTEM` note. `AGENTS.md` is excluded by default (opt back in via the toggle).

**The result in practice.** A minimal-mode prompt for this conversation would run 500-700 tokens. Nano mode brings that to 150-250. On a 1B parameter model with a 4096-token context window, that difference is meaningful. On a 3B model with a 8192-token window, it can mean the difference between a model that fits and one that does not.

## When nano mode makes sense

It is not a general-purpose upgrade. Nano mode is a trade-off: you give up tool richness and prompt guidance in exchange for lower overhead. The trade-off is worth making when:

- You are running a small open-weights model (1B to 7B parameters) locally, often on CPU or with limited VRAM.
- Your context window is constrained and you want to maximise space for actual work rather than system text.
- The task is bounded enough that the model does not need to explore the codebase extensively.

It is not the right choice for a 70B model on a fast GPU. That model has the headroom to use the full prompt. Nano mode is for the other end of the hardware spectrum.

## The configuration surface

Nano mode ships with a preset called "Nano (low-end hardware)" that sets the tool profile and trim level together. There is also an **Include AGENTS.md** toggle that lets you opt back in to the AGENTS.md section if your setup handles it. That toggle is there because some users want the project-specific context from AGENTS.md even when running a small model.

The `/tune` menu controls both the profile selection and the toggle. Changes are session-scoped.

## How the prompt sections are structured

The nano mode prompt sections live alongside the existing ones in `source/app/prompts/sections/`:

```
constraints-nano.md       — three-line constraints block
file-editing-nano.md     — compressed file operations guidance
task-approach-nano-normal.md   — four-line task approach
task-approach-nano-auto-accept.md
task-approach-nano-plan.md
task-approach-nano-scheduler.md
```

Each section is authored to be self-contained and to assume the model already has the general context that the full sections provide. The assumption is that if you are running a model small enough to need nano mode, you are probably working in a codebase the model already understands — or can understand from a targeted prompt rather than from a system-level brief.

## The 150-250 token range

The exact token count varies with the tune profile (normal, auto-accept, plan, scheduler) and whether AGENTS.md is included. The range above reflects a normal-mode prompt with AGENTS.md excluded. The `generate-system-prompts` script in the repo can produce exact token counts offline if you want to verify before running.

If you want to check what the prompt looks like without running the model, you can run:

```bash
pnpm run generate-system-prompts
```

This produces a snapshot of every prompt variant. It is the same script used for offline token counting during development.

## What this does not do

Nano mode does not change how tools are called or how responses are parsed. Those are handled by the tool-call layer and the AI SDK, not by the prompt profile. It also does not change context window management, auto-compact behaviour, or token budgeting — those operate at the session layer.

If you are hitting context window limits with nano mode, the issue is not the system prompt. It is the conversation length, and the usual tools (auto-compact, manual `/compact`, or `/clear`) still apply.

---

Nano mode is available now in v1.26.0. Select it via `/tune` or set it in `agents.config.json` under the appropriate provider or model entry.

https://github.com/Nano-Collective/nanocoder