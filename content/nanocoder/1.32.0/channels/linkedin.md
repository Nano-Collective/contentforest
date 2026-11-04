---
product: nanocoder
version: "1.32.0"
channel: linkedin
title: "Nanocoder v1.32.0"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 1698
---

Nanocoder v1.32.0 is out. Most of this release goes into the parts of the agent that editors talk to.

ACP gets the biggest overhaul. An editor can now supply its own MCP servers per session, and those tools exist only in that session and in any subagent it starts. Sessions keep their own provider and model, so one thread cannot change another's. An editor can turn a built-in tool off for a session, pin a session against retention, cancel a single subagent without ending the turn, and read a file's before-image from a checkpoint. Extension methods now use the `_` prefix ACP reserves for custom methods, and `initialize` lists the exact names, so a client detects support rather than guessing from a version number.

There is also an Agentic CI/CD Gate. `nanocoder verify --pr <n>` runs a headless, read-only PR review with a semgrep pass over the changed files. The per-project daemon can watch GitHub Actions for failures, run a read-only investigator, post the diagnosis to the PR, and at a raised trust level fix the failure in an isolated clone. The fix agent has no shell tool and no GitHub tokens, so a CI log cannot steer it into running commands.

Two new capabilities you can use directly: a built-in `browser` tool (navigate, click, type, screenshot) on one shared headless Chromium page, and voice mode with local Whisper and Piper by default.

Also in this release: per-session trust checks via `nanocoder trust --status` and `trust --grant`, `nanocoder.autoCommit`, `nanocoder.formatters`, `?key=value` overrides for slash commands, MCP liveness checks, and an agent evaluation harness under `benchmarks/agent/`.

Repo and changelog: https://github.com/Nano-Collective/nanocoder
