---
product: nanocoder
version: "1.27.0"
channel: github-discussion
title: "Choosing your Nanocoder extension point"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.27.0 gives you three distinct surfaces for adding custom behaviour. Custom commands, Custom Tools, and MCP servers each solve a different problem and map to different trade-offs. Picking the right one from the start saves you retrofitting work later.

This post maps all three, with concrete guidance on which to reach for and when.

## The three extension surfaces

### Custom Commands: prompt injection

A custom command is a markdown file in `.nanocoder/commands/` that defines a reusable prompt. When you invoke it with `/my-command`, the file body gets injected into the system prompt as context. Nanocoder then responds as it normally would, without running any external code.

**What you get:**
- Named slash command (`/my-command`)
- Parameter substitution via named placeholders
- Auto-injection via `triggers` or `tags` keywords
- Namespacing via subdirectories (`refactor/dry.md` becomes `/refactor:dry`)

**What you do not get:**
- Execution. The prompt is context only. If your command says "run this script and return the output", the model will describe what it would do rather than actually running it.
- Tool access by default. The model has its normal tool set, but the command itself does not grant a new tool.

**Use custom commands when:** you want to encode a pattern or convention that the model should follow consistently, or to parameterise a frequently-typed prompt. Examples from the docs: a test-convention command that reminds the model about AVA framework rules, or a dry-refactor command that encodes your team's extraction approach.

**Do not use custom commands when:** you need something to actually run. For that, you need Custom Tools or MCP.

### Custom Tools: shell-quoted markdown

A Custom Tool is a markdown file in `.nanocoder/tools/` (project) or `~/.config/nanocoder/tools/` (personal). It declares an input schema in YAML frontmatter and writes a shell command body. The model can call it like any built-in tool. Parameters are validated against the schema, the body is rendered with substitutions, and stdout is returned to the model.

**What you get:**
- A first-class tool callable by the model, confirmed by you
- JSON Schema-style parameter validation (types, required, pattern, minLength, etc.)
- Shell-quoted substitution (named placeholders and conditional sections) - all values are POSIX-shell-escaped, blocking injection through parameter values
- `approval` and `read_only` flags that participate in mode policy
- Registration into the same `ToolManager` registry as built-ins and MCP tools - visible via `/tools`

**What you do not get:**
- A persistent external process. Each invocation spawns a shell, runs the command, returns.
- The full MCP protocol (capabilities, notifications, structured schemas from the server).

**Security model:** the tool runs with your full shell privileges. The trust boundary is "you wrote this file or you trust the repo it came from." Parameter values are shell-escaped, but the body is whatever you wrote. Treat project-level Custom Tools the same way you treat `.nanocoder/commands/`, `.envrc`, or `package.json` scripts.

**Use Custom Tools when:** you have a CLI that produces useful output (kubectl, gh, jq, curl, a custom shell wrapper) and you want the model to call it with parameterised input. The sweet spot is project-local helpers that do not need their own process or state between calls.

**Do not use Custom Tools when:** the tool needs to maintain state between calls, spans multiple rounds of interaction without Nanocoder, or is something you want to share across multiple Nanocoder installations. For those cases, reach for MCP.

### MCP servers: external process + full protocol

An MCP server is a process you configure in `.mcp.json` (project) or `~/.config/nanocoder/.mcp.json` (personal). Nanocoder communicates with it via the Model Context Protocol over stdio, HTTP, or WebSocket. The server advertises its available tools; Nanocoder registers them alongside built-ins.

**What you get:**
- A persistent external process with its own state
- Structured tool schemas defined by the server
- Full MCP protocol (capabilities, server-side tool resolution)
- HTTP and WebSocket transports for remote servers
- `alwaysAllow` per-server tool-level configuration

**What you do not get:** automatically. The same is true of any external tool. You are responsible for the server's availability, its auth setup, and its resource usage.

**Use MCP when:** the capability you need is maintained outside Nanocoder (a database, a remote API with session state, a code indexer that maintains an on-disk cache), when you want to share the integration across multiple AI tools, or when the server ships a well-defined tool schema that changes without you having to edit a markdown file.

**Do not use MCP when:** a simple shell wrapper would do the job. If the integration is project-local, stateless, and callable as a one-liner, a Custom Tool is lighter and has no separate process to manage.

## The decision matrix

Here is the short version for common cases.

**You want the model to follow a convention or pattern consistently.**
Custom command. Put it in `.nanocoder/commands/` and invoke via slash command or trigger.

**You want the model to call a CLI tool and get structured output back.**
Custom Tool. Drop a `.md` file in `.nanocoder/tools/`, write the shell body, confirm execution.

**You want a tool that maintains state between calls or needs its own process.**
MCP server. Configure it in `.mcp.json`. Use stdio for local, HTTP or WebSocket for remote.

**You want to package a command, a subagent, and a tool together as one shippable unit.**
Skills bundle. Put them in `.nanocoder/skills/<name>/` with a `skill.yaml` manifest. The subagent automatically sees its sibling tools, scoped tools stay hidden from the global list, and commands auto-namespace.

## One concrete example

Suppose you have a `kubectl`-based workflow: list pods, tail logs, describe a resource. With a Custom Tool:

```markdown
---
name: k8s_pods
description: List pods in a Kubernetes namespace
parameters:
  namespace:
    type: string
    required: true
    pattern: '^[a-z0-9-]+$'
    maxLength: 63
approval: never
read_only: true
---
kubectl get pods -n my-namespace
```

The model can call `k8s_pods({ namespace: "default" })` directly. Parameters are validated, the shell-quoted substitution prevents injection, and stdout comes back as a tool result. No separate process, no MCP config, no server to maintain.

The same workflow over MCP requires a running server process, a `.mcp.json` entry, and the server's own tool schema. That is the right trade-off when the server maintains state you need (a cache, a session, an index) or when you are sharing it across tools. It is the wrong trade-off for a stateless shell wrapper that only needs to exist while Nanocoder is running.

## Modes and tool availability

Custom Tools have explicit mode behaviour. Plan mode only allows `approval: never && read_only: true` tools. Scheduler (cron) mode also requires `approval: never`. MCP tools have their own `alwaysAllow` configuration in `.mcp.json`, independent of the Custom Tool approval flags.

Custom commands are always available. They are prompt injection, not tool calls, so mode restrictions do not apply to them.

## Project vs personal

Custom commands, Custom Tools, and single-file skill members live in both project-level (`.nanocoder/`) and user-level (`~/.config/nanocoder/`) directories. Project-level files take precedence by name. MCP servers follow the same precedence: project `.mcp.json` overrides the global one.

For Custom Tools specifically, project tools shadow personal tools by name. This lets a team ship a standard set of tools with the repo while allowing individuals to override or extend with their own.

## Getting started

- `/commands create <name>` - scaffold a custom command with AI help
- `/tools create <name>` - scaffold a Custom Tool with AI help
- `/setup-mcp` - interactive MCP server configuration
- `/skills` - list everything loaded (commands, agents, tools, subscriptions)

Docs at https://github.com/Nano-Collective/nanocoder - or dive straight into the docs:
- Custom Commands: https://docs.nanocollective.org/nanocoder/docs/v1.27.0/features/custom-commands.md
- Custom Tools: https://docs.nanocollective.org/nanocoder/docs/v1.27.0/features/custom-tools.md
- MCP: https://docs.nanocollective.org/nanocoder/docs/v1.27.0/configuration/mcp-configuration.md
- Skills: https://docs.nanocollective.org/nanocoder/docs/v1.27.0/features/skills.md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.