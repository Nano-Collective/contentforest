---
product: nanocoder
version: "1.25.0"
channel: reddit
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.25.0 shipped. Here's what we changed and why.

The headline features:

**Subagents** — the main agent can now delegate work to isolated child agents. Two built-ins ship with this release: Explore (read-only codebase investigation) and Reviewer (code review). They can run in parallel — up to 5 at once, each with live in-place progress rendering. You can also define your own as markdown files in `.nanocoder/agents/`. Thanks to @brijeshkr for the initial implementation.

**Yolo mode** — a new development mode that auto-accepts every tool call without exception, including bash commands and destructive git operations. The status bar turns red when active. We had auto-accept already, but it still required approval for bash and destructive git. Yolo closes that gap.

**Plan mode actually works now** — previously it allowed mutation tools. It now enforces read-only tools at the policy level. The intended workflow: switch to plan, describe your task, the agent investigates and writes a structured plan, then you switch to normal/auto-accept/yolo and execute. No accidental writes.

**Tune** — `/tune` (`Ctrl+T`) gives per-session control over tool profiles (full or minimal for small models), compact mode, native tool calling, and model parameters. Persists for the session.

**ChatGPT Codex** — new provider with OAuth device flow authentication and streaming. Works alongside MiniMax and Kimi in the redesigned provider setup wizard.

**Other stuff**: startup is faster (parallel initialization), desktop notifications, `/credits`, `/setup-config`, better `alwaysAllow` handling for bash (three-bug fix that was annoying people), and a scheduler memory leak.

Full changelog: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.