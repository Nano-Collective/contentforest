---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.25.0 is out.

This release rethinks the core agent loop. Here's what matters for developers using it day to day:

**Yolo mode** — a new development mode that auto-accepts every tool call without exception, including bash and destructive git. The status bar turns red when active. Shift+Tab cycles through normal → auto-accept → yolo → plan.

**Subagents** — the LLM can now delegate focused tasks to isolated child agents. Two built-ins ship now: Explore (read-only codebase investigation) and Reviewer (code review). Up to 5 can run in parallel. Custom subagents are defined as markdown files with YAML frontmatter in `.nanocoder/agents/`. Thanks to @brijeshkr for the initial implementation.

**Plan mode works properly now** — it now enforces read-only tools at the policy level. No accidental writes. The intended workflow is: switch to plan, investigate, get a structured plan, then switch to normal/auto-accept/yolo to execute.

**Tune** — `/tune` (`Ctrl+T`) gives per-session control over tool profiles (full/minimal), compact mode, native tool calling, and model parameters. Persists for the session.

**New provider: ChatGPT Codex** — OAuth device flow authentication, streaming, credential management. Works alongside MiniMax and Kimi in the redesigned provider setup wizard.

**Also**: startup is faster (parallel init), desktop notifications, `/credits`, `/setup-config`, and a handful of bugs that have been annoying people for a while are fixed.

Full changelog and docs: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.