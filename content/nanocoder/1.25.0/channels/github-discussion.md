---
product: nanocoder
version: "1.25.0"
channel: github-discussion
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

# Nanocoder v1.25.0

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

---

Nanocoder v1.25.0 rethinks the core agent loop, adds a proper delegation system, ships a new development mode, and tightens a handful of long-standing rough edges. Here's what changed and why.

## Yolo mode

A new development mode that auto-accepts every tool call without exception, including bash commands and destructive git operations (hard reset, force delete, stash drop/clear). Toggle through normal → auto-accept → yolo → plan with **Shift+Tab**. The status bar turns red when yolo mode is active, so there's no ambiguity about the safety posture.

Auto-accept mode already existed but still required approval for bash and destructive git. Yolo closes that gap. Use it when you fully trust the agent and want zero friction.

## Subagents

The LLM can now delegate work to isolated child conversations called subagents. Each subagent has its own system prompt, filtered tool set, and optionally a different model. Only the final result is returned to the main conversation.

Two built-in subagents ship with this release:

- **Explore** — read-only codebase investigation. Useful for gathering context without polluting your main conversation with search results.
- **Reviewer** — code review with actionable feedback.

Subagents can also run in parallel (up to 5 concurrent). When the agent calls the `agent` tool multiple times in a single response, all calls execute concurrently with live in-place progress rendering.

Define custom subagents as markdown files with YAML frontmatter in `.nanocoder/agents/`:

```markdown
---
name: local-research
description: Fast local codebase research using Ollama
provider: ollama
model: ministral-3:3b
tools:
  - read_file
  - search_file_contents
  - find_files
  - list_directory
---

You are a codebase research agent. Search and read files to answer questions.
Always use your tools — never guess.
```

Manage agents with the `/agents` command (`show`, `create`, `copy`). Thanks to @brijeshkr for the initial implementation. Closes #414.

## Plan mode actually works now

Plan mode previously allowed mutation tools. It now enforces read-only tools at the policy level — all write, bash, git write, and task management tools are blocked. The plan-mode system prompt instructs the agent to investigate thoroughly and produce a structured plan with summary, files to modify, step-by-step approach, dependencies/risks, and open questions. No execution.

The intended workflow is: switch to plan mode, describe your task, let the agent investigate and write a plan, then switch to normal/auto-accept/yolo and execute. Your conversation history is preserved across the mode switch.

## Modular system prompt

The monolithic `main-prompt.md` is gone. System prompt sections are now individual files under `source/app/prompts/sections/` (identity, core principles, coding practices, file editing, tool rules, diagnostics, task management, etc.). A `prompt-builder` assembles the prompt dynamically based on the current mode — normal, auto-accept, plan, and scheduler each get a tailored prompt with only the sections and tools relevant to that mode.

A `generate-system-prompts` script is included for offline token counting and prompt inspection. This makes the system prompt auditable and easier to modify incrementally.

## Tune

`/tune` opens a modal UI (`Ctrl+T`) with tool profiles (full, minimal), a `disableNativeTools` toggle for forcing XML fallback, aggressive compact mode, and model parameters (temperature, top-p, top-k, max tokens, frequency/presence penalty). Tune state persists for the session and is reflected in the mode indicator (`tune: minimal | compact | temp:0.7`).

The minimal tool profile is designed for small models (1B-8B parameters) that struggle with large tool sets. It reduces the system prompt size and forces single-tool-at-a-time calls.

## ChatGPT Codex provider

ChatGPT Codex is now available as a provider with OAuth device flow authentication (`/codex-login`), streaming responses, and Codex-specific credential management. It integrates with the provider setup wizard and model fetcher alongside MiniMax and Kimi.

## Provider setup wizard

The provider setup wizard has been redesigned with a unified model fetcher that auto-detects API compatibility (OpenAI-compatible, Ollama, Anthropic, Google) and fetches available models from the provider's endpoint. Simplified the provider step UI and added MiniMax and Kimi provider templates.

## web_search: Brave Search API replaces scraping

The `web_search` tool was using `cheerio` to scrape Brave Search. It now uses the official Brave Search API via `BRAVE_SEARCH_API_KEY` in `agents.config.json`. More reliable, no longer depends on HTML structure.

## Other additions

- **`/setup-config`** — lists all Nanocoder config files with their paths and opens the selected one in your editor.
- **Configurable paste threshold** — single-line paste handling now has a configurable threshold in `nanocoder-preferences.json`. Thanks to @grenkoca.
- **Notifications** — desktop notifications for tool confirmations, question prompts, and generation completions. Supports macOS, Linux, and Windows.
- **`/credits`** — shows project contributors and dependency versions.
- **CLI quality metrics** — new `benchmarks/` directory tracks correctness, performance, stability, and health. Run `pnpm run benchmark`.

## Startup performance

LLM client and subagent initialization now run in parallel on the critical path. Update checks, MCP servers, and LSP servers initialize in the background without blocking the chat. The full status box has been replaced with a lightweight one-line `BootSummary`.

## Bug fixes

- `alwaysAllow` config was not being respected for `execute_bash`. Three interconnected bugs prevented it: top-level `alwaysAllow` was never loaded from `agents.config.json`, `isNanocoderToolAlwaysAllowed` only checked `nanocoderTools.alwaysAllow`, and `nonInteractiveAlwaysAllow` set `needsApproval` on AI SDK tools. Closes #431.
- `dimColor` was making text inaccessible on some screens. Closes #440.
- Tasks now clear when running `/clear`.
- Prevented MiniMax/Kimi from resolving to Anthropic template.
- Fixed default model for MiniMax provider.
- `/usage` and context percentage were showing stale system prompt length. Added `setLastBuiltPrompt` and fixed `useContextPercentage` overwriting cache.
- Fixed Ollama timeout handling for slow local models. Timeout errors are now detected case-insensitively and IPv6 loopback addresses are correctly resolved. Thanks to @ragini-pandey.
- Scheduler mode memory leak: chat messages and components now clear before each scheduled job execution. Closes #452.

## Security fixes

- Addressed semgrep security finding in `console.error`. Thanks to @brijeshkr.
- Replaced `exec()` with `execFile()` in the VS Code extension installer to prevent command injection. Thanks to @ragini-pandey.
- Fixed vulnerable packages. Thanks to @brijeshkr.

## Debug logging

Added debug logging to 15 silent catch blocks in git utilities that were swallowing errors invisibly. Operational catches now log at debug level for easier diagnosis. Boolean probes (e.g. `isGitAvailable`, `branchExists`) remain intentionally silent. Thanks to @ragini-pandey.

---

Full changelog: [CHANGELOG.md](https://github.com/Nano-Collective/nanocoder/blob/main/CHANGELOG.md)

Discuss on [GitHub](https://github.com/Nano-Collective/nanocoder) or [Discord](https://discord.gg/ktPDV6rekE).