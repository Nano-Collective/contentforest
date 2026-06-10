---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.25.0 shipped subagents — isolated child conversations the main agent can delegate to. Two built-ins come with the release (Explore and Reviewer), but the more useful thing is that you can define your own.

A subagent is a markdown file with YAML frontmatter. Drop it in `.nanocoder/agents/` and the main agent picks it up automatically. No code changes needed.

The frontmatter controls scope: tool allowlist, model override, provider. The markdown body is the system prompt.

The tool list is the design decision. Narrow scope works best — give the subagent exactly the tools it needs and nothing more.

Example: a local-research subagent using a small Ollama model with read-only tools. The main conversation stays on your primary provider; the research work runs locally.

Parallel execution is built in — the main agent can delegate to multiple subagents at once (up to 5), each with live in-place progress rendering.

Manage with `/agents show`, `/agents create`, `/agents copy`.

Full docs and examples: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.