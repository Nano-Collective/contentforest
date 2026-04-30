---
product: nanocoder
version: "1.25.0"
channel: personal:will:linkedin
generated_at: "2026-04-30T22:59:33.881Z"
model: "minimax-m2.7"
char_count: 1539
---

# Nanocoder v1.25.0 is out

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

Nanocoder v1.25.0 is one of the more substantial releases we've shipped. I wanted to walk through a few of the changes I think are worth understanding individually, because they each solve a real problem rather than just adding surface area.

**Subagents** solve something I kept running into: when you're mid-task and want the agent to do something exploratory — check if a file is dead code, run a targeted review — you had to interrupt the main conversation or open a second instance. Subagents let the agent spin up an isolated child conversation for that kind of work. The two built-in ones (Explore and Reviewer) cover the cases that came up most often, and the interface for adding your own via `.nanocoder/agents/` markdown files means the community can build domain-specific variants without touching the core.

**Plan mode with actual enforcement** was the one I wanted most. The old version relied on the model honouring a prompt instruction, but that's a soft constraint. This release blocks mutation tools at the policy level in plan mode — only the read-only exploration tools work. The model produces a structured plan (files to modify, steps, risks, open questions) rather than attempting changes, and the policy enforces that boundary rather than trusting the model to self-restrain.

**Yolo mode** is for when you want the agent to run without stopping for confirmation but still want to review the conversation afterwards. It auto-accepts every tool, including the genuinely dangerous git operations (hard reset, force delete, stash drop). The status bar turns red so the state is unambiguous. I cycled it in during testing and it made a difference to the kinds of tasks I could hand off in one go.

On the architecture side, **the modular system prompt** replaces a monolithic file with composable section files under `source/app/prompts/sections/`. The prompt-builder assembles what's needed for each mode. A `generate-system-prompts` script lets you inspect the full assembled prompt offline before running — useful if you want to understand what the model actually has access to at any given moment, or count tokens.

The web search migration to the **Brave Search API** is a quality-of-life one: it now fails loudly with no key rather than silently falling back to broken scraping behaviour.

There are also meaningful bug fixes in this release. The `alwaysAllow` bash issue was three interconnected bugs (#431). The `dimColor` accessibility issue (#440). The scheduler memory leak. Fifteen silent catch blocks in git utilities that were swallowing errors without logging. All resolved.

Security patches included: a semgrep finding, vulnerable package updates, and `exec()` replaced with `execFile()` in the VS Code extension installer to prevent command injection.

A lot of this is visible in the changelog — worth reading if you want to dig into the specifics.

Repo: https://github.com/Nano-Collective/nanocoder
