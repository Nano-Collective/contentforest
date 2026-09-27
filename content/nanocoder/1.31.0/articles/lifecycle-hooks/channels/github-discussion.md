---
product: nanocoder
version: "1.31.0"
channel: github-discussion
title: "Lifecycle hooks in v1.31: rules that fire every time, for free"
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 13360
---

Nanocoder's agent loop has six predictable points where a rule should fire: when a session starts, when it ends, when you submit a prompt, before a tool runs, after it returns, and just before context compaction. v1.31 promotes those points from implicit behaviours into a real configuration surface. You can wire a shell command to any of them. It runs every time, it costs no model tokens, and on two of the six points it can refuse to let the action happen.

The full feature is documented at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder) under `docs/v1.31.0/features/hooks.md`. This article is the angle piece: what hooks are for, why they exist alongside skill subscriptions, what v1.31 added on top of them, and how a `pre-tool-use` hook actually blocks a tool call before the approval prompt.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## What a hook is

A hook is one shell command. You declare it in `agents.config.json` under `nanocoder.hooks`, keyed by lifecycle event, and Nanocoder runs it at that point in the loop:

```json
{
  "nanocoder": {
    "hooks": {
      "session-start": [
        { "command": "git log --oneline -5" }
      ],
      "post-tool-use": [
        {
          "matchTools": ["write_file", "string_replace"],
          "command": "biome check --write \"$NANOCODER_FILE\""
        }
      ],
      "pre-tool-use": [
        {
          "name": "no-env",
          "matchTools": ["write_file", "string_replace"],
          "command": ".nanocoder/hooks/guard.sh"
        }
      ]
    }
  }
}
```

Three things to notice. One: a hook is a shell command, not a prompt. Two: it fires whether or not the model remembers to call it. Three: it runs with no model in the loop, so it costs nothing on the prompt-cache bill and it does not show up in `/usage`. That's the operational shape the rest of this article builds on.

## The six lifecycle points

| Event | Fires | Can veto |
|---|---|---|
| `session-start` | Once, as the session initializes | no |
| `session-end` | During graceful shutdown, before the UI tears down | no |
| `user-prompt-submit` | Before a chat prompt is sent to the model | yes |
| `pre-tool-use` | Before a tool executes, ahead of any approval prompt | yes |
| `post-tool-use` | After a tool returns, including when it fails | no |
| `pre-compact` | Before context compaction, automatic or `/compact` | no |

Two of them can veto. `user-prompt-submit` can refuse to send your prompt to the model (a safety check, a policy gate, a redaction step). `pre-tool-use` can refuse to let the tool run. The rest are observational: they can print things that get injected back into context, but they cannot stop the train.

`user-prompt-submit` is narrower than it looks. It fires for chat prompts only, not for slash commands (`/compact`) or `!bash` passthroughs, because those are local actions and prefixing either one would break the routing that recognises them. Leading whitespace does not change this: `  /compact` is still a slash command, and a `user-prompt-submit` hook does not see it. The buffer the hook would have populated stays queued for the next prompt that actually reaches the model.

## Why hooks exist alongside skill subscriptions

Nanocoder already has skill subscriptions, and they look superficially similar. The distinction is the point of the whole feature.

| | Skill subscriptions | Hooks |
|---|---|---|
| Triggered by | The outside world (a file changed, a cron fired) | Nanocoder itself |
| What runs | An AI subagent | A shell command |
| Cost | LLM tokens on every fire | Free, instant |
| Deterministic | No | Yes |
| Requires the daemon | Yes | No |
| Can veto an action | No | Yes (`pre-tool-use`) |

Reach for a subscription when you want an AI to look at something that changed. Reach for a hook when you want something to happen, exactly, every time. The "every time" is the part that motivates hooks existing at all. A rule that says "format every TypeScript file the agent writes" is enforceable as a hook and unenforceable as a subscription, because the subscription depends on the model deciding to call it.

## What's new in v1.31: `matchPaths`

The hook system is not new. What v1.31 adds is `matchPaths`, the second of the two scoping fields. Together with `matchTools` it lets one formatter per language be declared directly, instead of dispatching inside the command:

```json
"post-tool-use": [
  {
    "matchTools": ["write_file", "string_replace"],
    "matchPaths": ["**/*.{ts,tsx}"],
    "command": "npx prettier --write \"$NANOCODER_FILE\""
  },
  {
    "matchTools": ["write_file", "string_replace"],
    "matchPaths": ["**/*.go"],
    "command": "gofmt -w \"$NANOCODER_FILE\""
  }
]
```

Before this, the only way to scope a hook by file was to dispatch on the extension inside the command with a `case` statement. That worked on a POSIX shell and stopped working the moment the hook needed to run on Windows, because `case` patterns and globbing do not cross the shell boundary. `matchPaths` is the portable version of that pattern, and it is not just for formatting. "Only lint `src/**`" and "audit-log writes under `infra/`" use the same field.

The patterns use the same dialect as skill subscriptions: `**` across directories, `*` within one, `?` for a single character, and `{a,b}` for alternation. The file is whichever of `path`, `file_path`, or `filePath` the tool was called with, which is every file tool.

Two behaviours worth knowing. A hook scoped by path does not fire for a tool that touched no file. `execute_bash` has no file, so `matchPaths` excludes it. That is the opposite of an omitted `matchTools`, which widens to every tool: omitting a tool filter means "match all tools", but omitting a path filter means "I have no opinion on paths". Events with no file at all (`session-start`, `session-end`, `user-prompt-submit`, `pre-compact`) ignore `matchPaths` entirely. And an absolute path is matched relative to the project root, so a root-anchored pattern like `src/**` fires whether the model wrote `src/a.ts` or the absolute form for the same edit.

## How a `pre-tool-use` hook actually blocks a tool call

The veto semantics are the part that earns the most attention in the docs, because they sit alongside the approval policy rather than inside it. On `pre-tool-use` and `user-prompt-submit`, a non-zero exit denies the action. The hook's stdout is handed back to the model as the reason, so the model can adapt rather than retry blindly. If the hook printed nothing on stdout, its stderr is used instead.

`.nanocoder/hooks/guard.sh`:

```bash
#!/usr/bin/env bash
case "$NANOCODER_FILE" in
  .env|.env.*|*/.env)
    echo ".env is managed outside the repo. Edit .env.example instead."
    exit 1
    ;;
esac
```

The model then sees:

```
Error: Blocked by hook "no-env": .env is managed outside the repo. Edit .env.example instead.
```

The interesting sentence is "sits alongside, not inside, the approval policy". In the interactive TUI and in subagents the gate runs *before* the approval decision, so a denied tool never renders a confirmation prompt and never reaches the handler. You see the denial, not a diff preview you have to approve first. The one surface where the order differs is ACP: the editor owns the permission request there and issues it before Nanocoder runs the tool, so an editor prompt can appear for a call the hook then refuses. The call is still blocked, and the denial still goes back to the model as the reason.

The gate is applied again at each execution boundary (`processToolUse`, the streaming bash path, the subagent loop), so no surface can reach a handler ungated. The hook itself still runs exactly once per tool call, so a hook with side effects, like an audit log, records one line per call, not one per layer. The first veto ends the chain: later hooks on the same event do not run.

Only a deliberate non-zero exit blocks. A hook that hangs past its `timeout` is killed, logged, and skipped, so a broken script degrades to "no hook" instead of wedging the agent. On the other events a non-zero exit is logged and the remaining hooks still run, because refusing an observation has no operational meaning.

## Hooks are not merged

This is the part operators miss until a project starts ignoring a global rule. Like the rest of `agents.config.json`, the nearest `hooks` block replaces the one above it rather than combining with it. A project that defines any hook at all disables *every* global hook, including a global `pre-tool-use` policy. If you rely on a global rule, repeat it in the projects that define their own hooks. `/doctor` prints everything that actually loaded, and it is the right place to verify what a project has wired up.

## Injecting context back into the model

Hooks are not just gates. They can also print things that the model sees. Anything a hook prints on stdout is put in front of the model as additional context, and the injection point depends on the event.

`post-tool-use` stdout is appended to that tool's result inside a `<hook-output>` block, so a formatter's complaint lands on the same turn rather than the next one. The combined result is re-capped afterwards, so a chatty hook cannot push a tool result past the usual truncation limit. `session-start` and `user-prompt-submit` stdout is buffered and prepended to your next prompt inside a `<hook-context>` block. Your transcript still shows what you typed. `/clear` drops anything undelivered.

`session-start` does not hold up the UI. It runs in the background while the session finishes initializing. It is only waited on at the point it matters, which is the first prompt you submit: if the hook is still running, that submission waits for it rather than letting the context slip to prompt two. So keep `session-start` hooks fast, and give anything genuinely slow its own short `timeout` (the default is 30 seconds, and it is your first prompt that pays for it).

## The security shape

Hooks are project-local shell commands, so `agents.config.json` in a repository is a code-execution surface, exactly like the `mcpServers` in the same file and like `.nanocoder/tools/`. All of them are gated by the directory-trust prompt you accept the first time Nanocoder runs in a directory. Treat an untrusted repository's `agents.config.json` the way you would treat its `package.json` scripts, and use `/doctor` to see what a project has wired up.

Hooks inherit Nanocoder's whole environment. The `NANOCODER_*` variables are *added* to `process.env`, not a replacement for it, so a hook can read every provider API key, token, and secret the agent itself was started with. That is what makes ordinary hooks work (`git`, `biome`, and `docker` all need their usual environment), but it means a hook can exfiltrate credentials as easily as it can format a file. This is the same trust you extend to an `mcpServers` entry in the same file, which is spawned with the same environment. If a hook does not need the secrets, unset them in the hook itself (`env -u ANTHROPIC_API_KEY …`) rather than assuming it cannot see them.

Quote your variables. Your `command` is the only thing Nanocoder puts on the shell command line. Everything the model influenced arrives through the environment instead, so a model-chosen path can never inject into the command itself. But once your hook expands one of those variables, normal shell rules apply, and the model picked the value. Write `biome check --write "$NANOCODER_FILE"`, not `biome check --write $NANOCODER_FILE`, so a path with a space or a `;` in it stays one argument.

## `session-end` runs on a shutdown budget

`session-end` is the one event whose timeout story is non-obvious. It fires inside graceful shutdown, which races *every* shutdown handler (the session autosave flush and the UI teardown included) against a single budget (5 seconds by default, `NANOCODER_DEFAULT_SHUTDOWN_TIMEOUT`) and then exits the process. The general 30-second default is unreachable there, so `session-end` hooks default to a 2-second timeout instead, low enough to finish and still leave the rest of the shutdown room to run.

Keep them short. If you need longer, raise `NANOCODER_DEFAULT_SHUTDOWN_TIMEOUT` as well as the hook's own `timeout`; raising only the hook's does nothing, because the process exits first. Anything genuinely slow (uploading a transcript, say) is better started detached than waited on.

## Where this leaves the loop

The shape v1.31 settles into is: skill subscriptions for "look at this change with an AI", hooks for "do this exact thing every time", and `matchPaths` as the missing piece that makes per-language rules portable across platforms. The veto semantics on `pre-tool-use` and `user-prompt-submit` mean a hook can sit ahead of the approval prompt and refuse a tool call before any diff preview renders, which is the closest thing in the loop to a real policy gate. The trust story lives in `agents.config.json` in a repository, and `/doctor` is the way to see what is wired up.

Full docs and changelog at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder). If anything is broken or surprising, open an issue or drop a note in Discord.
