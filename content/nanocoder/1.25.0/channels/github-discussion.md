---
product: nanocoder
version: "1.25.0"
channel: github-discussion
generated_at: "2026-04-30T22:59:33.881Z"
model: "minimax-m2.7"
char_count: 0
---

# Nanocoder v1.25.0

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

Nanocoder v1.25.0 is a significant release with several major features and a large set of quality-of-life improvements. Here's what's changed.

## Subagents

Nanocoder now supports **delegated child conversations** that the LLM can spin up for focused, isolated work. Two built-in agents ship out of the box:

- **Explore** — read-only codebase investigation. Asks questions, maps structure, reports findings without touching anything.
- **Reviewer** — runs a targeted code review and returns actionable feedback.

Subagents are defined as markdown files with YAML frontmatter (`name`, `description`, `model`, `allowed tools`) and live in `.nanocoder/agents/`. You can add your own by dropping a markdown file in that directory. The `/agents` command manages them (`show`, `create`).

The LLM can also launch multiple subagents in parallel — each gets an independent tool set and live in-place progress rendering. Subagent tool approval mirrors the main agent's behaviour: write tools prompt for approval, bash always prompts unless `alwaysAllow` is configured, and the `agent` tool itself no longer requires approval since the subagent's internal tools carry their own gates.

This unlocks workflows where a review or exploration runs alongside the main task without interrupting it.

## Yolo mode

A new development mode that **auto-accepts every tool without exception**, including bash commands and destructive git operations — hard reset, force delete, stash drop, stash clear. It sits alongside the existing normal, auto-accept, and plan modes, cycling via `Shift+Tab`. The status bar turns red to make it clear when yolo mode is active.

Use it when you want the agent to make changes without stopping for confirmation, but still want to be able to review the conversation afterwards.

## Plan mode, made useful

Plan mode previously relied on a prompt telling the model to plan rather than execute, but nothing enforced it at the tool level. That's fixed. Plan mode now blocks all mutation tools (`write_file`, `execute_bash`, `git commit`/`push`, task management) at the policy level, leaving only exploration tools (`read_file`, `search_file_contents`, `find_files`, `list_directory`, `git log`/`diff`/`status`). The system prompt instructs the LLM to investigate thoroughly and produce a structured plan with summary, files to modify, step-by-step approach, dependencies/risks, and open questions — not to attempt changes.

## Modular system prompt architecture

The monolithic `main-prompt.md` has been replaced with individual section files under `source/app/prompts/sections/` — identity, core principles, coding practices, file editing, tool rules, diagnostics, task management, and more. A new `prompt-builder` assembles the prompt dynamically based on the current mode, so normal, auto-accept, plan, and scheduler each get a prompt tailored to what that mode actually needs. A `generate-system-prompts` script lets you inspect the assembled prompts offline and count tokens before running.

## ChatGPT Codex provider

Added ChatGPT Codex as a provider with OAuth device flow authentication via `/codex-login`, streaming response support via a dedicated `StreamingMessage` component, and Codex-specific credential management. The provider template and setup wizard are integrated.

## web_search: Brave Search migration

The `web_search` tool has moved from HTML scraping to the official Brave Search API. This requires a `BRAVE_SEARCH_API_KEY` in `agents.config.json` under `nanocoderTools.webSearch.apiKey`. The `cheerio` scraping dependency is removed. If you don't configure a key, web search won't function — which is cleaner than silently falling back to broken behaviour.

## /setup-config

A new `/setup-config` command lists all config files (project and global `agents.config.json`, `.mcp.json`, `nanocoder-preferences.json`) with their paths and opens the selected one in your editor.

## Paste threshold, now configurable

Paste handling for single-line pastes had a hard-coded threshold. It's now a user preference in `nanocoder-preferences.json` with a default that matches the previous behaviour. Thanks to @grenkoca.

## Tool output truncation and terminal width

Every tool formatter now respects terminal width for output. This includes `execute_bash`, file operations, git tools, `search_file_contents`, and `web_search`. Long lines from minified files, large executables, or search results no longer blow up the terminal.

## Provider setup wizard, redesigned

The provider configuration wizard now has a unified model fetcher that auto-detects API compatibility (OpenAI-compatible, Ollama, Anthropic, Google) and fetches available models from the provider's endpoint. The provider step UI is simplified. MiniMax and Kimi provider templates are included.

## Fixes

- `alwaysAllow` for `execute_bash` was broken across three interconnected issues — top-level `alwaysAllow` was never loaded, `isNanocoderToolAlwaysAllowed` checked the wrong field, and `nonInteractiveAlwaysAllow` set `needsApproval` on AI SDK tools but the loop evaluated it from the registry. Closes #431.
- `dimColor` made text inaccessible on some screens. Closes #440.
- `/clear` now clears the task list.
- MiniMax/Kimi provider configuration prevented correct Anthropic template detection.
- Default model for MiniMax provider was wrong.
- `/usage` and context percentage showed stale system prompt length — fixed.
- 15 silent catch blocks in git utilities were swallowing errors invisibly — now log at debug level. Boolean probes remain silent.
- Ollama timeout handling now detects timeout errors case-insensitively and handles IPv6 loopback correctly.
- Scheduler mode had a memory leak — chat messages and components now clear before each job execution.

## Security

- Semgrep finding in `console.error` addressed. Thanks to @brijeshkr.
- Vulnerable packages fixed. Thanks to @brijeshkr.
- `exec()` replaced with `execFile()` in VS Code extension installer to prevent command injection. Thanks to @ragini-pandey.

## Other additions

- `/credits` — lists project contributors (auto-generated from git history) and dependency versions.
- Desktop notifications for tool confirmations, question prompts, and generation completions. Supports macOS (`terminal-notifier` with osascript fallback), Linux (`notify-send`), and Windows (PowerShell). Configurable per-event in `nanocoder-preferences.json` and in `/settings`.
- CLI quality metrics framework (`benchmarks/measure.ts`, `benchmarks/report.ts`) tracking correctness, performance, stability, and health.
- Startup time reduced by parallelizing LLM client and subagent initialization, and deferring update checks, MCP servers, and LSP servers to non-blocking background tasks.

## Full changelog

See [CHANGELOG.md](https://github.com/Nano-Collective/nanocoder/blob/main/CHANGELOG.md) for the complete list of changes, including dependency updates and smaller fixes.

If you run into issues or want to discuss a feature, open an issue or reach out on [Discord](https://discord.gg/ktPDV6rekE).