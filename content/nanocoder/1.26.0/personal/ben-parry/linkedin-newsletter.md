---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:01:16.016Z"
model: "minimax-m2.7"
char_count: 4812
---

This week we shipped Nanocoder v1.26.0. Three things landed that I want to talk about properly, not as a changelog, but as an illustration of a pattern I keep running into when building tooling for AI.

## The scaffold problem

Small open-weights models have improved faster than most people expected. A 3B parameter model running on a laptop can do genuinely useful work. The model itself is not the constraint anymore, at least not for a large class of tasks.

The constraint is the scaffolding.

System prompts that run 500-700 tokens before the model says anything useful. Tool sets that assume cloud infrastructure. Context overhead that multiplies cost on every turn. None of this breaks a cloud API budget. All of it makes on-device deployment impractical.

You can have a capable model and an impractical system.

This is a recurring pattern in AI tooling: the model is often not the bottleneck. The architecture around it is.

## Nano mode: shrinking the scaffolding

v1.26.0 adds a third profile under `/tune`, alongside the existing full and minimal profiles. Nano mode is the most aggressive profile, it drops the system prompt to roughly 150-250 tokens.

Here is what that looks like in practice:

- `find_files`, `list_directory`, and `agent` are removed from the tool set. These tools are essential in a cloud-hosted setup; they are unnecessary overhead when you are running a 1B or 3B model on modest hardware. Removing them is not a regression; it is a targeted removal for a specific deployment context.
- `CORE PRINCIPLES` and `CODING PRACTICES` are trimmed. `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` become 4-line blocks. The `SYSTEM INFORMATION` section collapses to a single-line note.
- A "Nano (low-end hardware)" preset ships out of the box. An `Include AGENTS.md` toggle lets you opt back in if your setup handles it.

The result is a system prompt that fits in the space that matters for small models, running on hardware that is affordable and local.

## The regulated-industry case

The context that keeps coming up in conversations I have is healthcare and legal. organisations that cannot send data to a cloud API because of regulatory requirements, client confidentiality, or data residency rules.

The question they are asking is: "Is on-device AI actually viable for our workflow?"

Nano mode is an answer to that question. Not "yes, here is how to make it work". It does not solve every problem. But it removes one of the structural barriers: the model is capable enough; the system around it was not.

When the scaffolding is light enough, the same model becomes practical. When the system prompt overhead drops from 500-700 tokens to 150-250, the economics of on-device inference shift.

This is an architecture decision, not a feature. The feature is "nano mode". The architecture decision is: the tool should work where the work happens, not only where the budget allows.

## Reasoning traces and the CI flag

The other two additions I want to highlight are reasoning traces and the `--plain` flag.

Reasoning traces stream the thinking content from models like Codex GPT-5, DeepSeek-R1, and Anthropic extended thinking in real time, rendered as a collapsible Thought block above the response. Toggle expansion with `Control+R`. Set a default via the Display Settings panel under `/settings`.

This is useful in two distinct ways. For people building: you see how the model is approaching the problem, which helps when things go wrong. For people evaluating: reasoning traces make the system's behaviour legible, which matters in any context where you need to explain a decision (legal, medical, financial).

The `--plain` flag strips Ink rendering entirely for non-interactive use. CI pipelines, shell scripts, programmatic pipes. Deterministic exit codes. Clean stdout. No interactive prompts. If you are running Nanocoder as part of an automated workflow, this is the flag.

## What this is building toward

The pattern across all three additions is the same: Nanocoder is designed to work in environments where cloud API access is not the default, not the assumption, or not possible. Hardware-constrained. Regulated. Automated.

Nano mode is the clearest expression of that direction so far. But it connects to the other work too, context window overrides per provider and per model, the `disabledTools` configuration, the new Display Settings panel. These are all ways of making the system configurable for environments that do not look like a developer running Nanocoder on a MacBook Pro connected to an OpenAI API key.

That is the direction. The architecture will tell you where it goes.

More at the link below.

---

Built by the [Nano Collective](https://nanocollective.org).