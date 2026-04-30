---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-04-30T22:59:33.881Z"
model: "minimax-m2.7"
char_count: 0
---

# Nanocoder v1.25.0 is out

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

Nanocoder v1.25.0 is a substantial release. Here's what's new:

**Subagents** — the agent can now spin up isolated child conversations for focused work. Two built-in agents ship out of the box: Explore (read-only codebase investigation) and Reviewer (code review with actionable feedback). Subagents run in parallel, each with independent tool sets and live progress rendering. You can add your own by dropping a markdown file in `.nanocoder/agents/`.

**Yolo mode** — a new development mode that auto-accepts every tool without exception, including destructive git operations. Cycles via Shift+Tab alongside normal, auto-accept, and plan modes. The status bar turns red to make the state unambiguous.

**Plan mode, enforced** — plan mode now blocks mutation tools at the policy level, not just by prompt. Only read-only tools work: read_file, search_file_contents, find_files, list_directory, git log/diff/status. The model is instructed to investigate and produce a structured plan, not attempt changes.

**Modular system prompts** — the monolithic main prompt has been replaced with composable section files under `source/app/prompts/sections/`. A prompt-builder assembles the right prompt for each mode. A `generate-system-prompts` script lets you inspect and token-count offline.

**ChatGPT Codex provider** — OAuth device flow authentication via `/codex-login`, streaming responses, and full wizard integration.

**web_search migrated to official Brave Search API** — requires a `BRAVE_SEARCH_API_KEY` in `agents.config.json`. Cleaner than silent scraping failure.

Plus: `/setup-config`, configurable paste threshold, tool output truncation to terminal width, redesigned provider wizard, `/credits`, desktop notifications, reduced startup time, scheduler memory leak fix, and security patches.

Full details and changelog: https://github.com/Nano-Collective/nanocoder