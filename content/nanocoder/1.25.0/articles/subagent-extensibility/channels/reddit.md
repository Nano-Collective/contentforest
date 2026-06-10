---
product: nanocoder
version: "1.25.0"
channel: reddit
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.25.0 shipped subagents. Two built-ins come with the release (Explore and Reviewer), but the more interesting part is that you can define your own as markdown files in `.nanocoder/agents/`.

Here's the format:

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

You are a codebase research agent. Always use your tools — never guess.
```

The `tools` list is the design decision. Narrow scope = less risk, better focus. Explore has read-only tools only. Reviewer has `read_file` and `git_diff`, no write tools. A test-runner subagent might have `read_file` and `execute_bash`.

The model override is the other useful part — run a small Ollama model for code research locally while the main conversation stays on your primary provider.

Parallel execution: the main agent can call the `agent` tool multiple times in a single response and all run concurrently (up to 5). Live in-place progress rendering for each.

Manage with `/agents show`, `/agents create`, `/agents copy`. Built-ins (Explore, Reviewer) are internal; custom subagents live in `.nanocoder/agents/`.

More in the full docs: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective — a community collective building AI tooling not for profit, but for the community.