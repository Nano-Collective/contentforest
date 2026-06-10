---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.27.0"
generated_at: "2026-06-02T15:30:53.389Z"
model: "minimax-m3"
char_count: 5304
wont_use_at: "2026-06-10T09:28:56.495Z"
---

Most software runs when you tell it to. The model in v1.27.0 is different: it runs when something relevant happens.

This is a builder's log on what that looks like inside, and why the architecture landed where it did.

## The problem with on-demand

On-demand invocation is clean and intuitive. You run a command, you get output, you're done. It works well when the work maps onto a discrete action.

It breaks down when the work is continuous. A developer saves a file, reviews a diff, waits for a build, merges a branch. Each of these moments is a decision point. If the tool only runs when invoked, those moments pass without the context that would have made the tool useful.

The alternative most tools reach for is a scheduler. Run every N minutes. This covers more ground, but it runs blind. The scheduler has no model of what changed, only that a clock ticked. The system fires when it is convenient for itself, not when something happened that warrants a response.

Neither pattern is wrong. But neither is enough on its own.

## What v1.27.0 does

Nanocoder now ships with a background daemon that responds to events in your project: file changes, cron schedules, and custom events you define in skill frontmatter.

When the right signal fires, the daemon dispatches a Nanocoder session in headless mode. No prompts, no foreground confirmations, no interactive TUI. The session runs and finishes. Per-subscription configuration lets you route certain events into plan mode instead, where a human approval step sits between the signal and the execution.

The daemon starts with `nanocoder daemon start` and keeps running as a background process with a lockfile and Unix socket IPC. Installers for launchd (macOS) and systemd user units are included, so it survives across sessions and restarts cleanly.

File watching uses a trailing debounce of 500ms so a fast save loop in a chatty editor does not pile up a queue of runs. Per-subscription concurrency is backpressure-capped so that a misconfigured subscription cannot overwhelm the system.

## Why Skills make this coherent

The daemon would be a useful standalone feature. What makes it worth building into the core is what sits underneath it: Skills.

Nanocoder has had three extension types: custom commands, subagents, and tools. Each lived in a separate directory, loaded by a separate loader. They worked, but they did not compose particularly well. A subagent that needed a specific tool had to be told about it explicitly. Commands and tools did not share context.

Skills replace all three with a unified surface. A skill lives in `.nanocoder/skills/<name>/` as a directory with a `skill.yaml` manifest and optional `commands/`, `agents/`, and `tools/` subdirectories. Everything inside a bundle ships and versions together. A bundle's subagent automatically gets its sibling tools. Scoped tools stay hidden from the global tool list. Commands auto-namespace: `commands/status.md` inside bundle `git` invokes as `/git:status`.

The old single-file forms in `.nanocoder/commands|agents|tools/` still work. The bundle form is additive. Downstream consumers keep using the same registries.

What this means for the daemon: when a skill subscribes to a file change or cron event, the daemon has a rich, versioned, self-describing unit to invoke. The signal arrives at an extension surface that knows what it is and what it needs.

## Custom Tools: the middle extension point

Between custom commands (prompt injection only) and full MCP servers (external process, full protocol), there was a gap. You could define a shell script, but only as a prompt-level instruction that the model had to route through its own reasoning. You could wire up MCP, but that requires a running server process with a defined protocol and transport.

Custom Tools fill the gap. Drop a `.md` into `.nanocoder/tools/` with YAML parameter declarations and a shell command body using template placeholders. All substitutions are shell-quoted, which means injection is structurally prevented rather than relying on careful prompting.

The definition shape is intentionally close to MCP's approach, but simpler: no external process, no transport layer, no server lifecycle to manage. The model sees the parameter schema and the command body. It decides when to call it. The substitution layer handles quoting so the command does what the parameter values say, not what an adversarial input string tries to make them do.

`approval` and `read_only` flags compose with mode policy: plan mode requires `approval=never && read_only=true`, headless/scheduler requires `approval=never`.

## The architecture holds together

There is a thread connecting all of this. On-demand invocation is a hammer. Event-triggered runs, built on top of a composable extension surface, with a parameterised tool layer that the model can invoke safely, give you a system that responds to what happens in the codebase rather than waiting to be called.

The daemon does not do much on its own. What makes it worth having is the Skills architecture beneath it, and what makes Skills worth having is that the right signal can reach the right behaviour without manual intervention.

The scheduler it replaces was honest about what it was: a timer. The daemon is honest about what it is: a responder. The difference is the architecture it runs on.

## What comes next

The daemon starts as opt-in. The skill subscription model will expand to cover more event types and more composability between skills. Custom Tools will grow a discovery mechanism and a broader set of parameter types. The goal is a system where the event model and the extension model deepen each other: more events make the extension surface more useful, and a richer extension surface makes more event-driven patterns viable.

More at nanocollective.org.