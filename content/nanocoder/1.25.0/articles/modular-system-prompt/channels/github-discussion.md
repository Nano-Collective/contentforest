---
product: nanocoder
version: "1.25.0"
channel: github-discussion
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

# How the Nanocoder system prompt is now assembled

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

---

v1.25.0 replaced the monolithic `main-prompt.md` with a modular system prompt architecture. This is a structural change worth knowing about, particularly if you've ever tried to understand or modify what the agent knows about your project.

## What changed

The old approach had one large markdown file containing all instructions for all modes. Editing anything meant touching that file. The new approach has individual section files under `source/app/prompts/sections/`:

- `identity.md` — how Nanocoder introduces itself
- `core-principles.md` — the operating principles (accuracy over validation, trust the reader, etc.)
- `coding-practices.md` — code writing guidance
- `file-editing.md` — string_replace and write_file instructions
- `tool-rules.md` — tool usage patterns and constraints
- `diagnostics.md` — how to handle errors and warnings
- `task-management.md` — how to use the task tools
- ...and others

A `prompt-builder` reads these sections and assembles the final system prompt dynamically, based on the current mode.

## The modes and their differences

The four modes are normal, auto-accept, plan, and scheduler. Each gets a tailored prompt:

**Normal mode** — the standard interactive use case. Gets the full tool set and instruction set.

**Auto-accept mode** — auto-confirms non-destructive tools. The prompt still includes bash and write tools, but the approval step is handled automatically. Useful when you trust the agent and want to reduce friction.

**Plan mode** — read-only, produces a structured plan instead of executing. All write tools, bash, and task management tools are blocked at the policy level. The system prompt is assembled without those tool instructions — they're not just unavailable, they're not in the prompt at all. This is a cleaner separation than the old architecture where plan mode had to be enforced entirely through tool filtering.

**Scheduler mode** — runs on a cron schedule. Has its own tailored prompt for automated context-window operation.

## The generate-system-prompts script

A `generate-system-prompts` script is included for offline inspection. Run it to output the assembled system prompt for any mode without starting an interactive session. Useful for:

- **Token counting** — see exactly how many tokens the system prompt contributes to each turn before you run a session.
- **Review** — read what the model is actually told about your project, tools, and constraints.
- **Debugging** — if the agent's behaviour seems off, checking the assembled prompt is a reasonable first step.

## Why the architecture matters for operators

The modular sections make the system prompt incrementally auditable. Before, you had one long document. Now you can read `file-editing.md` in isolation to understand what the agent knows about string_replace, or check `task-management.md` to understand how the agent is instructed to use the task tools.

This also makes incremental modification more manageable. If you want to add or change instructions for a specific mode, you modify the relevant section rather than searching through one large file.

For custom commands and skill injection: the new architecture keeps those concerns separated. A custom command with skill-like fields (tags, triggers, estimated-tokens, resources) is handled separately from the core system prompt — the prompt-builder incorporates them at the right point in assembly without them being hardcoded into a monolithic file.

## What this doesn't change

The assembled system prompt is still treated as a whole by the prompt-builder — it doesn't expose individual sections as independent variables or let you swap one section for another without the builder knowing. This is an architectural change to make the prompt auditable and modifiable, not a general-purpose configuration system.

The system prompt is still Nanocoder's internal instruction set. If you want to understand or tweak it, the sections are a better entry point than they were before. But they're still Nanocoder's prompt, not a public config surface.

---

Questions and examples welcome on [GitHub](https://github.com/Nano-Collective/nanocoder) or [Discord](https://discord.gg/ktPDV6rekE).