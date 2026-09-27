---
product: nanocoder
version: "1.31.0"
channel: reddit
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 5895
---

One thing shipped in Nanocoder v1.31 that I want to walk through is lifecycle hooks, because they earn the term "deterministic" in a way most of the agent loop does not.

The shape is simple. There are six predictable points in the agent loop: `session-start`, `session-end`, `user-prompt-submit`, `pre-tool-use`, `post-tool-use`, and `pre-compact`. You can wire a shell command to any of them under `nanocoder.hooks` in `agents.config.json`. It runs every time, with no model in the loop, no tokens, and no daemon. On two of the six points (`pre-tool-use` and `user-prompt-submit`) a non-zero exit can refuse to let the action happen. The message goes back to the model so it can adapt instead of retrying blindly.

## Why we have hooks and skill subscriptions, and what each is for

The distinction is the point. Skill subscriptions are triggered by the outside world (a file changed, a cron fired) and run an AI subagent. They are useful when you want an AI to look at something that changed. Hooks are triggered by Nanocoder itself, run a shell command, cost nothing, and are deterministic. They are useful when you want something to happen exactly, every time, rather than when the model remembers to.

The classic example is "format every TypeScript file the agent writes". That is enforceable as a `post-tool-use` hook on `write_file` and `string_replace` with `npx prettier --write "$NANOCODER_FILE"`. As a subscription it is unenforceable, because the subscription depends on the model deciding to call it.

## What v1.31 adds: `matchPaths`

Hooks existed before v1.31. What v1.31 adds is `matchPaths`, the second of the two scoping fields. With `matchTools` it lets one formatter per language be declared directly:

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

Before this, the only way to scope a hook by file was to dispatch on the extension inside the command with a `case` statement. That worked on POSIX and stopped working the moment a hook needed to run on Windows. `matchPaths` is the portable version of that pattern. The patterns use the same dialect as skill subscriptions (`**`, `*`, `?`, `{a,b}`), and the file is whichever of `path`, `file_path`, or `filePath` the tool was called with.

Two behaviours worth knowing. A hook scoped by path does not fire for a tool that touched no file. `execute_bash` has no file, so it is excluded; that is the opposite of an omitted `matchTools`, which widens to every tool. And an absolute path is matched relative to the project root, so a root-anchored pattern like `src/**` fires whether the model wrote `src/a.ts` or the absolute form for the same edit.

## How `pre-tool-use` blocks a tool call

The veto semantics are what earn the feature the term "policy gate". On `pre-tool-use` and `user-prompt-submit`, a non-zero exit denies the action. The hook's stdout is handed back to the model as the reason. If the hook printed nothing on stdout, its stderr is used instead.

A `pre-tool-use` hook for blocking writes to `.env`:

```bash
#!/usr/bin/env bash
case "$NANOCODER_FILE" in
  .env|.env.*|*/.env)
    echo ".env is managed outside the repo. Edit .env.example instead."
    exit 1
    ;;
esac
```

The model sees:

```
Error: Blocked by hook "no-env": .env is managed outside the repo. Edit .env.example instead.
```

In the interactive TUI and in subagents the gate runs before the approval decision, so a denied tool never renders a confirmation prompt. You see the denial, not a diff preview you have to approve first. ACP is the one surface where the editor issues the permission prompt first, but the call is still blocked, and the denial still goes back to the model.

The gate is applied at each execution boundary, so no surface can reach a handler ungated. The hook itself still runs exactly once per call, so a hook with side effects (an audit log, say) records one line per call, not one per layer.

## Things operators miss

Hooks are not merged. Like the rest of `agents.config.json`, the nearest `hooks` block replaces the one above it. A project that defines any hook at all disables every global hook, including a global `pre-tool-use` policy. `/doctor` prints everything that actually loaded, and it is the right place to verify what a project has wired up.

`session-start` runs in the background while the session initializes and is only waited on at the first prompt you submit. So keep `session-start` hooks fast, and give anything slow its own short `timeout`, because the default 30 seconds is your first prompt that pays for it.

`session-end` is bounded by the shutdown budget, not by its own `timeout` (5 seconds default, `NANOCODER_DEFAULT_SHUTDOWN_TIMEOUT`). Raising only the hook's timeout does nothing, because the process exits first. Anything genuinely slow is better started detached than waited on.

## The trust story

Hooks are project-local shell commands, so `agents.config.json` in a repository is a code-execution surface, like `mcpServers` and `.nanocoder/tools/`. Hooks inherit Nanocoder's whole environment, so a hook can read every provider API key the agent itself was started with. That is what makes ordinary hooks work, but it means a hook can exfiltrate credentials as easily as it can format a file. If a hook does not need the secrets, unset them in the hook itself (`env -u ANTHROPIC_API_KEY …`) rather than assuming it cannot see them.

The directory-trust prompt you accept the first time Nanocoder runs in a directory covers this, and `/doctor` is the way to see what a project has wired up before you trust it.

Full docs and changelog at https://github.com/Nano-Collective/nanocoder.
