---
product: nanocoder
version: "1.25.0"
channel: reddit
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.25.0 shipped a refactor worth knowing about if you've ever looked at the system prompt: the monolithic `main-prompt.md` is gone. System prompt sections are now individual files under `source/app/prompts/sections/`.

The sections are things like identity, core principles, coding practices, file editing, tool rules, diagnostics, task management — each one a separate file. A `prompt-builder` assembles them dynamically based on the current mode.

The modes are:

- **Normal** — standard interactive use.
- **Auto-accept** — auto-confirms non-destructive tools.
- **Plan** — read-only, produces a structured plan instead of executing.
- **Scheduler** — runs on a cron schedule, has its own tailored prompt.

Each mode gets only the sections and tools relevant to it. Plan mode, for instance, doesn't need write tools or bash tools in the system prompt — they're blocked at the policy level, but also not in the prompt at all. That's a cleaner separation than the old monolithic file.

The `generate-system-prompts` script lets you inspect the assembled prompt offline — useful for counting tokens before a session, or reviewing what the model actually knows about your environment.

Why it changed: the old `main-prompt.md` was getting harder to modify incrementally. Any change required touching one large file. Sections make the prompt incrementally auditable — you can read identity in isolation, or check what the file editing instructions say without navigating a long document.

For operators who want to understand or tweak the agent's behaviour: the sections are now a reasonable entry point. Each one is readable on its own.

The generated system prompt for each mode is still treated as a whole — the prompt-builder doesn't expose the sections as independent variables. But having them as files rather than sections in one large markdown document makes the architecture cleaner.

If you've been running custom system prompt instructions alongside Nanocoder, this architecture may make those overrides easier to manage — they can target specific sections rather than patching a monolithic document.

Full docs: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.