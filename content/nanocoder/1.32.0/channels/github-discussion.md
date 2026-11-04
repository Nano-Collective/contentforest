---
product: nanocoder
version: "1.32.0"
channel: github-discussion
title: "Nanocoder v1.32.0 - ACP matures, a CI gate, browser and voice"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 17857
---

Nanocoder v1.32.0 is out. This is a large release, and most of it goes into the parts of the agent that editors talk to: the ACP protocol surface, session isolation, and the agentic CI gate.

```bash
npm install -g @nanocollective/nanocoder
```

Repo, issues and the full changelog: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## ACP: the protocol surface grew up

Nanocoder's ACP agent (the one that backs the VS Code sidebar and works with other ACP clients) is where most of the work in this release landed. The theme is that an editor should be able to drive a session precisely, and should be able to tell what the agent supports rather than guess.

### The editor supplies the MCP servers

An editor can now send `mcpServers` on `session/new`, `session/load` and `session/resume`. Stdio and HTTP servers are connected for that session only, so their tools exist in that session and in any subagent it starts, and in no other session. Your own MCP configuration is never read and never changed.

```json
{
  "method": "session/new",
  "params": {
    "cwd": "/path/to/project",
    "mcpServers": {
      "docs": { "command": "docs-server", "args": ["--stdio"] }
    }
  }
}
```

Loading or resuming a session replaces its previous set. Closing or deleting the session disconnects them. A server that fails to connect, or one that uses SSE, is logged and skipped, and the request still succeeds. `initialize` reports `mcpCapabilities` (`http`). A tool whose name collides with an existing tool is skipped, and these tools follow the usual approval rules.

### Extension methods use the reserved `_` prefix

ACP reserves method names starting with `_` for custom methods, and Nanocoder's now follow that convention:

| Method | What it does |
| --- | --- |
| `_nanocoder/renameSession` | Sets a session's title |
| `_nanocoder/pinSession` | Marks a session as retained, or clears the mark |
| `_nanocoder/timeline/list` | Lists the session's file-change checkpoints |
| `_nanocoder/timeline/revert` | Reverts files and history to before a checkpoint |
| `_nanocoder/timeline/read` | Reads a file's before-image for a checkpoint |
| `_nanocoder/retryTurn` | Removes the last turn so the prompt can be sent again |
| `_nanocoder/cancelSubagent` | Cancels one running subagent |

The bare names still work as deprecated aliases and log a one-time notice. They will be removed in a later release. `initialize` now lists the exact method and notification names under `agentCapabilities._meta.nanocoder`, so a client can detect support from the list instead of inferring it from a version number. An unrecognised custom request now fails with the standard JSON-RPC "Method not found" (`-32601`) rather than a plain error.

### Per-session provider and model

Sessions keep their own provider and model. `session/set_config_option` affects only that session: a running turn finishes on the model it started with, subagents use the session's model, the config options returned for a session are its own, and saved sessions record their own choice. `session/resume` and `session/load` restore the saved provider and model when they are still available, and otherwise stay on the default and report the saved choice in `_meta["nanocoder/modelFallback"]`. The agent advertises `agentCapabilities._meta.nanocoder.perSessionModel`.

### Turning tools off per session

An editor that ships its own version of a tool can ask Nanocoder not to offer the built-in one:

```json
{ "_meta": { "nanocoder/disabledTools": ["browser"] } }
```

The names are added to the user's own `disabledTools` rather than replacing it, and apply to that session only. The tools are left out of the tool list and the prompt, a call the model makes to one anyway is refused and nothing runs, and subagents respect the same list. The response `_meta` reports the list in effect under the same key, so a client can verify it. The list is not saved with the session, and the user's config files are never read or changed for this.

### Pinned sessions and retention

`_nanocoder/pinSession` (`sessionId`, `pinned`) exempts a session from retention. Neither `retentionDays` nor `maxSessions` deletes a pinned session, and pinned sessions do not count toward `maxSessions`. `session/delete` still removes them. `session/list` entries report the mark as `_meta["nanocoder/pinned"]`, and `initialize` reports the effective retention settings as `_meta["nanocoder/retention"]`.

### Subagents are visible and cancellable, one at a time

Nanocoder sends a `_nanocoder/subagent` notification as every run starts, progresses and ends (`completed`, `failed` or `cancelled`), with a stable `childRunId`, the `parentRunId`, the parent `agent` tool call, the subagent's name, progress counts and its result or error. `_nanocoder/cancelSubagent` cancels one run by `childRunId` without ending the turn: the run reports `cancelled`, the parent `agent` call gets a "Subagent was cancelled" result, and the turn carries on. Cancelling the whole turn still cancels every run. The permission request for a subagent's tool call now names its run under `_meta` as `nanocoder/childRunId`. Clients that ignore the notification see the same behaviour as before.

### Read-only before-images

`_nanocoder/timeline/read` returns a file's before-image for a timeline checkpoint: `text`, `created` or `unavailable`. `_nanocoder/timeline/list` entries now report `createdFiles` and a per-prompt `turnId`. `truncateToMessageIndex` changes with every model round-trip, so `turnId` is what groups the checkpoints belonging to one prompt. Checkpoints recorded before this change have no `turnId`.

### Sessions behave like sessions

A few more fixes in the same area:

- `session/close` is now handled. Nanocoder had advertised it since ACP sessions were added but never implemented it, so a client that called it got a method-not-found error. Closing cancels any running turn, stops queued prompts from starting, releases the session's timeline lock and drops the session from memory. The session stays on disk and can be loaded or resumed later.
- `session/load` fails with `Session not found on disk: <id>` for an ID that is neither in memory nor on disk, the same error `session/resume` already returned. It used to register an empty session and succeed, so a prompt sent to that ID saved a new session under an ID the client had invented.
- Each session works in its own `cwd`. Previously the file tools, `execute_bash`, the git tools, the project boundary, the system prompt and `AGENTS.md` all used the directory the agent process was spawned in, so an editor that started the agent elsewhere read and wrote the wrong files. A `cd` in one session no longer moves another. Project-level configuration is still read from the directory the agent starts in.
- Switching mode while a prompt is running now takes effect straight away. Previously the running prompt kept the mode it started in, so moving from `yolo` or `auto-accept` back to `normal` still let the next commands and file edits run without a permission prompt.
- `session/set_mode` rejects an unknown mode ID with an invalid-params error and leaves the mode unchanged, instead of silently falling back to `auto-accept`. A successful change is confirmed with a `current_mode_update` notification.
- A failed tool call now reaches the editor as `failed`. The status was set to `failed` only when the result text started with "Error", so a command that exited non-zero, a missing file and a validation failure all arrived as `completed`.
- Every subagent tool call is announced to the editor as it starts, not only the ones needing approval, and each settles with the tool's real result.
- ACP custom commands now fill the `args` placeholder and named parameters from the text after the command name, the same way the CLI does.
- `session/new`, `session/load` and `session/resume` responses list the offered tools that skip the permission prompt under `_meta["nanocoder/approval"].alwaysAllow`.

## The Agentic CI/CD Gate

Nanocoder can now review pull requests and investigate, and optionally fix, CI failures without an interactive session.

`nanocoder verify --pr <n> [--post-review]` runs a headless, read-only review with a semgrep pass over the PR's changed files, printing it or posting it as a PR comment:

```bash
nanocoder verify --pr 861
nanocoder verify --pr 861 --post-review
```

It refuses an untrusted directory (`--trust-directory` bypasses this for one run), and its reviewer can never comment, review or open PRs itself, whatever `alwaysAllow` says. `verify` always uses the built-in `verify-pr-review` agent, so a pull request cannot supply its own reviewer.

The per-project daemon can watch GitHub Actions for failures (`ciWatch` in global preferences, requires the `gh` CLI), run a read-only `verify-ci-investigator` subagent, post the diagnosis to the branch's PR, and send OS notifications. Skills can react to failures too with a new `ci.job.failed` trigger.

```bash
nanocoder daemon start --trust <comment-only|auto-fix|full-commit>
```

At `auto-fix`, the investigator fixes the failure in an isolated clone and pushes a new branch with a draft PR. At `full-commit` it pushes straight to the failing branch, after a one-time per-project confirmation. A failure on a commit the daemon itself pushed as a fix is never fixed a second time.

The safety notes are worth stating plainly:

- At `auto-fix` and `full-commit` the fix agent can edit and commit but has no shell tool, so it cannot run commands steered by a CI log. CI on its draft PR or push verifies the fix.
- The fix run starts without GitHub tokens, `gh` login, ssh-agent or git credential helpers. It reads the failed-step log the daemon fetched for it, and cannot push. The daemon publishes the result from the clone to the project's own `origin`.
- Anything posted to GitHub passes through a secret-redaction step first, and semgrep receives the changed paths after `--`.
- `full-commit` confirmation and `ciWatch` are only read from your global preferences, never from a project file. A `verify.trustLevel` of `auto-fix` or `full-commit` in `agents.config.json` needs confirmation at `daemon start`; unattended starts, including the installed service, fall back to `comment-only`.

`git_pr` also gained `diff`, `comment`, `review`, `checks` and `logs` actions, with CI run logs supporting search and pagination.

## A built-in browser

Nanocoder now has a `browser` tool (navigate, click, type, screenshot) on one shared headless Chromium page. Screenshots reach vision models as images. On OpenAI-compatible providers they follow the tool result as an image message.

Chromium itself is not bundled. Install it with:

```bash
npx playwright-core install chromium   # add --with-deps on Linux
```

Localhost is allowed, so you can point the agent at a local dev server. Private network and cloud metadata addresses are blocked. Hostnames are resolved before loading, as `fetch_url` does, so a public name pointing at a private or metadata address (for example `169.254.169.254.nip.io`) is blocked on navigation, on every page request and after redirects. Models that models.dev lists as text-only get the caption without the image. Models it does not list still get screenshots, but if the provider rejects a request for carrying images, it is retried once without them and later requests in the session leave them out.

## Voice mode

`/voice` turns voice mode on. Push-to-talk with `Ctrl+G`, or hands-free speech detection. Local Whisper speech-to-text and local Piper text-to-speech by default, with opt-in OpenAI cloud STT and TTS. Speaking or pressing `Ctrl+G` interrupts a running response.

The audio tools are installed on first use, with checksums verified. Hands-free mode is paused in yolo mode, so background speech cannot trigger unconfirmed tool calls. Voice state shows on the mode line under the prompt (`voice (Ctrl+G to talk)`, `● listening`, `transcribing…`, `speaking`).

## Directory trust, checked without starting anything

Clients can now check and grant directory trust without `--trust-directory`:

```bash
nanocoder trust --status [--json]
nanocoder trust --grant <fingerprint>
```

`--status` reports whether the folder is trusted (`trusted`, `not-trusted`, `changed` or `needs-re-approval`), what it will run and its fingerprint, and loads nothing from the folder, including its `.env` and any preferences file in it. `--grant` saves the folder only if its fingerprint still matches, so a client can save exactly what it showed the user. `nanocoder --acp` now exits with code `3` when it refuses an untrusted folder, instead of `1`, which other startup failures still use.

The trust prompt now lists the plugins, hooks, formatters, LSP servers, MCP servers, custom tools and subscribed skills, agents and commands in the folder. Trust stores a fingerprint of those files, and the prompt comes back when they change. A project `.env` can no longer set `XDG_CONFIG_HOME` or `APPDATA`, which decide where the trust record is stored, and it can no longer mark its own folder as trusted.

## Smaller things that changed how the agent behaves

- **Auto-commit.** `nanocoder.autoCommit` (off by default) commits every successful agent file edit on its own, with a Conventional Commit message the current model writes from that file's diff, falling back to `chore: update <path>` if the model call fails. Only the edited file is committed, so your own staged and unstaged work is never swept in. It runs git with `--literal-pathspecs`, so an edit to `[ab].txt` does not also match `a.txt` and `b.txt`. It is skipped outside a git repository, for ignored files, for no-op edits, and while a merge, rebase, cherry-pick or revert is in progress.
- **Formatters.** `nanocoder.formatters` runs code formatters (Prettier, Biome, gofmt, and so on) on every file the agent writes whose path matches a glob, before `post-tool-use` hooks fire. The model is told when a formatter changed the file, so its next edit starts from what is on disk.
- **Edit recovery evidence.** A failed `string_replace` or `diff_edit` search now returns bounded recovery evidence: likely target ranges, the exact current text, and whitespace or code-difference notes. Ambiguous targets and oversized evidence prompt a focused read before retrying. Failed edits remain exact-match-only and leave files unchanged.
- **Failure capsules.** A failing test or type-check run too long to pass to the model whole now reaches it as a failure capsule instead of a head-and-tail cut, which used to drop the failure detail printed in the middle of the log. Nanocoder recognises Jest, Vitest, Mocha, AVA and `tsc` output, keeps each failing test's title, location, assertion and expected/received diff, and narrows the original command to the first failing test. It re-runs that narrow command once to report whether the failure reproduces on its own.
- **Slash command overrides.** `?key=value` overrides let you test a setting for a single command without changing session state. `/usage ?context-max=200k` renders context usage against a 200k limit for that command only. `/compact ?threshold=80` gates manual compaction on current usage. Overrides are applied through the existing session-override plumbing and restored when the command finishes. Unknown keys are forwarded to the command verbatim and queue one warning, so a typo cannot silently no-op.
- **Enhanced `/help`.** Categorized command listings with command-specific details: usage, supported options and subcommands, aliases and examples.
- **Stale memory detection.** Project memories record the git commit, branch and a content hash of every tracked file they mention. On recall, a memory whose file has since been edited or deleted is injected with a short `[WARNING: recorded at <commit>, <file> has changed since. Verify before trusting.]` prefix.
- **MCP liveness.** Unhealthy MCP servers are detected by failed pings and transport closures, their unavailable tools are removed, and unhealthy servers show up in `/mcp`. A server that crashed or dropped its socket is reconnected from its config with exponential backoff, and its tools come back when it does. `healthCheckInterval: 0` disables pings entirely.
- **Session storage inspector.** `nanocoder storage` is a read-only interactive inspector for saved sessions and artifacts across Nanocoder and timeline/checkpoint data in the current project. `nanocoder storage --format json` gives a non-interactive report for scripts.
- **Worktrees.** `nanocoder worktree <PR-number>` starts an interactive session on a pull request in a dedicated sibling worktree, preserving the launching checkout.
- **Reverse prompt history.** `Ctrl+R` searches past prompts chronologically with case-insensitive substring matching, cycling through older matches. `Esc` restores your in-progress draft. The reasoning trace toggle moved from `Ctrl+R` to `Ctrl+N`.
- **Provider templates.** A first-class FutureInfra template (an OpenAI-compatible AI API router) fills in the base URL `https://futureinfra.ai/v1/ai`, so only an API key and a model name are needed. There is also a new API Route template. The default models suggested by the wizard were refreshed, so new configs no longer start on retired or outdated ids.
- **FXMacroData MCP template.** The `/settings mcp` wizard offers a remote HTTP MCP config pointing at `https://mcp.fxmacrodata.com`, giving the agent macroeconomic releases, central bank rates, release calendars and FX data across 22 currencies. The API key is optional; the keyless tier covers the last 90 days of USD releases, the USD release calendar, press releases, the data catalogue and market sessions for every