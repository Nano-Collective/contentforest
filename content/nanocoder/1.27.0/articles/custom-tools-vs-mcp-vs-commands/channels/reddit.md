---
product: nanocoder
version: "1.27.0"
channel: reddit
title: "Choosing your Nanocoder extension point"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m2.7"
char_count: 0
---

A decision that comes up a lot in Nanocoder's GitHub discussions: when do you reach for a custom command, a Custom Tool, or an MCP server? v1.27.0 ships all three, and they are easy to mix up.

Here is the short version:

A **custom command** is a prompt you inject into context. It lives in `.nanocoder/commands/`, becomes a slash command, and is just text as far as Nanocoder is concerned. No execution happens. Good for encoding conventions - things you want the model to remember and follow consistently. Bad if you need something to actually run.

A **Custom Tool** is a shell script with a YAML parameter schema. Drop it in `.nanocoder/tools/`, the model calls it like any built-in, and stdout comes back as a tool result. Parameters get validated against the schema and shell-quoted to prevent injection. This is the right level for wrapping CLI tools - kubectl, gh, jq, your own wrapper scripts. No separate process to manage.

An **MCP server** is a persistent external process configured in `.mcp.json`. Nanocoder talks to it over stdio, HTTP, or WebSocket. You get the full MCP protocol, persistent state, and structured schemas from the server. This is the right choice when the tool needs to maintain state between calls, or when you want to share the integration across multiple AI clients.

The most common mistake is reaching for MCP when a Custom Tool would do. If your integration is a stateless one-liner - run kubectl, get output, done - a Custom Tool is lighter and simpler. MCP is worth the extra config when you need the server's process and state.

All three are skill members. If you want to ship a command, a subagent, and a tool together as one bundle, the skills bundle form puts them in `.nanocoder/skills/<name>/` with a `skill.yaml` manifest.

Docs for all of it: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.