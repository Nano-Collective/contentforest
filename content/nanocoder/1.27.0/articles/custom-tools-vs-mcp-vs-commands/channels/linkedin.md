---
product: nanocoder
version: "1.27.0"
channel: linkedin
title: "Choosing your Nanocoder extension point"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.27.0 ships three distinct surfaces for adding custom behaviour. Most users reach for one and then discover they picked the wrong one partway through. Here is the short map.

**Custom commands** - prompt injection, no execution. Put a markdown file in `.nanocoder/commands/`, invoke via `/my-command`, and the body gets injected into the system prompt. Good for encoding conventions and patterns. Not for running anything.

**Custom Tools** - model-callable shell scripts. A markdown file in `.nanocoder/tools/` with YAML parameter schema and a shell body. The model calls it like a built-in tool. Parameters are validated and shell-quoted. Good for wrapping CLIs (kubectl, gh, jq) with parameterised input.

**MCP servers** - external process with full protocol. Configure a persistent process in `.mcp.json`. Nanocoder communicates over stdio, HTTP, or WebSocket. The right choice when the integration needs to maintain state between calls or when you are sharing it across tools.

Most confusion comes from Custom Tools vs MCP. If it is a stateless shell one-liner, use a Custom Tool. If it needs its own process or maintains state, use MCP.

All three surfaces are skill members. A skills bundle also lets you package a command, a subagent, and a tool together as one shippable unit.

Full decision guide and docs links at the repo: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.