---
product: nanocoder
version: "1.25.0"
channel: reddit
generated_at: "2026-04-30T22:59:33.881Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.25.0 is live.

This is one of the bigger releases we've shipped. Here's what changed and why it matters:

**Subagents** are probably the most significant new capability. The agent can now delegate work to isolated child conversations — Explore (read-only codebase investigation) and Reviewer (code review) ship built-in, and you can drop your own into `.nanocoder/agents/`. They run in parallel with independent tool sets and live progress rendering. If you've ever wanted a review to run while the main task continues, that's now possible.

**Yolo mode** is the new "trust everything" mode — it auto-accepts every tool including destructive git ops (hard reset, force delete, stash drop/clear). We cycled through normal → auto-accept → yolo → plan via Shift+Tab. The status bar turns red in yolo so the state is always unambiguous.

**Plan mode is now actually enforced.** Previously it relied on the model honouring a prompt instruction. Now mutation tools are blocked at the policy level — only read operations work. The model investigates and produces a structured plan, including files to modify, steps, risks, and open questions.

The **system prompt is now modular**. The old monolithic `main-prompt.md` is gone, replaced by composable section files. Different modes (normal, auto-accept, plan, scheduler) get different assembled prompts with only the relevant tools and instructions. We added a `generate-system-prompts` script so you can inspect the full prompt and count tokens before running.

On the provider side: **ChatGPT Codex** is now a supported provider with OAuth device flow (`/codex-login`), and the **web_search tool migrated from HTML scraping to the official Brave Search API** (requires an API key — if it's not configured, it fails loudly instead of silently breaking).

There are also a handful of real fixes in this release: `alwaysAllow` for bash was broken due to three interconnected bugs (#431), `dimColor` made text invisible on some screens (#440), the scheduler leaked memory across repeated runs, and 15 silent catch blocks in git utilities were swallowing errors without any log. All fixed.

Security patches included too: semgrep finding, vulnerable packages, and `exec()` → `execFile()` in the VS Code extension installer to prevent command injection.

If you're already using Nanocoder, update via `npm install -g @nanocollective/nanocoder`. If you're not, give it a try — it works with local models via Ollama, LM Studio, and MLX Server, or with controlled cloud APIs via OpenRouter and others.

Repo: https://github.com/Nano-Collective/nanocoder
Docs: https://docs.nanocollective.org/nanocoder/docs
Discord: https://discord.gg/ktPDV6rekE