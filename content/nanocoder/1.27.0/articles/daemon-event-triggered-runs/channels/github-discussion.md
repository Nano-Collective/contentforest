---
product: nanocoder
version: "1.27.0"
channel: github-discussion
title: "How Nanocoder's daemon replaces the scheduler"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.27.0 removes the old scheduler module entirely. What replaced it is a per-project background daemon that handles two event kinds (`file.changed` and `schedule.cron`) for skill subscriptions. This post walks through the daemon's architecture, the design decisions behind it, and what changed from the old model.

## Why a daemon, and why now

The scheduler that shipped in earlier Nanocoder versions ran as part of the interactive TUI process. That meant file watching and cron ticked only when you had the TUI open, and each triggered run shared the TUI's development mode (typically `ask` or `plan`). There was no way to run a subscription autonomously, and the scheduling state lived in a separate `.nanocoder/schedules.json` file that nothing else read.

v1.27.0 replaces this with a long-lived background process that owns the event loop for subscriptions. It runs independently of the TUI, installs as a user-level service on macOS and Linux, and executes triggered runs in `headless` mode by default (autonomous, no foreground prompts).

## Lockfile: ensuring a single instance

The daemon writes a JSON lockfile at `.nanocoder/daemon.json` on boot. The lock record contains the PID, the Unix socket path, and the start time:

```json
{
  "pid": 12345,
  "socketPath": ".nanocoder/daemon.sock",
  "startedAt": 1748300297000,
  "projectRoot": "/path/to/project"
}
```

Before starting, the daemon reads any existing lockfile. If the PID inside is still alive, the start is rejected with a message pointing at the running instance. Dead PIDs are reaped automatically (using `process.kill(pid, 0)` as a probe), so a crashed daemon does not block a fresh start.

Write atomicity is handled by writing to a sibling `.tmp` file and renaming in place, so a partially-written lockfile is never observable.

On Windows the lockfile path stays the same but the socket becomes a named pipe at `\\.\pipe\nanocoder-daemon-<hash>`, where the hash is a 10-character prefix of the project root's SHA-256. This keeps each project in its own pipe namespace.

## Unix socket IPC

The daemon's IPC surface is a single `AF_UNIX` socket at `.nanocoder/daemon.sock` (macOS and Linux). The protocol is minimal: newline-delimited JSON requests with matching responses.

```typescript
// Request
{"id": 1, "method": "listSubscriptions"}
// Response
{"id": 1, "result": [...]}
```

Supported methods: `ping`, `listSubscriptions`, `shutdown`. The `shutdown` method triggers a graceful event-loop drain (watcher stop, cron stop, IPC server close, lockfile removal) and is the clean path on Windows where `SIGTERM` would otherwise be force-kill.

The socket is removed before each `listen()` call so a stale socket from a previous crashed run does not block startup. The daemon unlinks the socket file on stop as well.

## Event sources: file watching and cron

Two event sources feed the daemon's router. Both start when the daemon boots, not when the TUI opens.

**File watching** uses `chokidar` under the hood. It watches the project root with sensible defaults: `node_modules`, `.git`, and `.nanocoder/` itself are excluded. The last exclusion is deliberate. Triggered runs write checkpoints under `.nanocoder/checkpoints/`, which would otherwise fire `file.changed` events and create a feedback loop. The `.nanocoder/` tree is loaded once at boot and is not hot-reloaded.

Emitted events carry the file path (relative to the project root) and the event kind (`add`, `change`, `unlink`). Subscription-level filtering against `paths` and `eventKinds` happens inside the event router, not in the source, so one watcher serves all `file.changed` subscriptions.

**Cron scheduling** registers with a `node-cron`-compatible timer. Each `schedule.cron` subscription registers its cron expression when the daemon boots. The cron source fires with the scheduled time as the event payload.

## Per-subscription concurrency cap and debouncing

The `BackpressureDispatcher` wraps the skill dispatcher and applies two protections by default, neither of which is configurable in v1.

**Concurrency cap of 1.** If an event arrives for a subscription that already has a run in flight, the new event is dropped. A `git pull` that produces 1,000 `file.changed` events in 200 ms will dispatch one run and drop the other 999, rather than spawning 1,000 parallel subagent processes.

**Trailing-edge debounce, 500 ms.** Applied only to `file.changed` events. Each event resets the timer; on expiry, the most recent event for that subscription is dispatched once. This prevents a linter run that touches 50 files from firing 50 separate triggered runs.

Cron events are not debounced. A cron schedule fires at its configured interval and dispatches immediately without the debounce layer.

## Headless mode vs the removed scheduler

The old scheduler ran inside the TUI process using the same mode the TUI was using. A triggered run would fire in `ask` mode or `plan` mode depending on the TUI's state, with no way to opt into autonomous execution.

The daemon's triggered runs execute in **`headless` mode** by default: no `ask_user`, no `agent` calls, no foreground confirmations. The subagent runs to completion autonomously. A triggered run that needs human review can set `confirm: true` on its subscription, which switches the execution to `plan` mode instead (the subagent proposes but does not apply).

```yaml
# autonomous (headless)
subscribe:
  - kind: file.changed
    paths: ["docs/**"]

# supervised (plan mode)
subscribe:
  - kind: file.changed
    paths: ["docs/**"]
    confirm: true
```

The `modeForSubscription` function in `source/skills/dispatcher.ts` encodes this distinction. It returns `'headless'` unless `confirm: true` is set, in which case it returns `'plan'`.

Checkpoint creation is tied to this choice. The dispatcher skips the checkpoint step for `confirm: true` runs because plan-mode runs make no file mutations that need reverting.

## Lifecycle and operational commands

```
nanocoder daemon start      # fork and detach
nanocoder daemon stop       # graceful drain via IPC, then SIGTERM fallback
nanocoder daemon status     # read lockfile, probe PID, report uptime
nanocoder daemon logs       # tail last 64KB of .nanocoder/daemon.log
nanocoder daemon install    # install launchd/systemd auto-start
nanocoder daemon uninstall # remove the auto-start unit
```

`daemon start` blocks until the lockfile is written. `daemon status` reads the lockfile and probes the PID to distinguish running from stale. Stale lockfiles are reaped silently on any read that finds a dead PID.

The log file is append-only. The default `onActivity` listener writes one line per triggered run: target, mode, event kind, subscription ID, duration, and an optional checkpoint ID or error.

## Migrating from schedules.json

The legacy `useSchedulerMode` hook, the scheduler view, and `.nanocoder/schedules.json` are gone. If the file is present when Nanocoder boots, a loud deprecation warning points at the migration guide.

The migration is a frontmatter edit. Move each cron entry into the targeted command's `subscribe:` block:

```markdown
<!-- .nanocoder/commands/weekly-report.md -->
---
description: Monday morning summary.
subscribe:
  - kind: schedule.cron
    cron: "0 9 * * MON"
---

Summarize last week's commits...
```

After migrating, run `nanocoder daemon start` (or `nanocoder daemon install` for auto-start across reboots) to activate the subscriptions.

The source lives at https://github.com/Nano-Collective/nanocoder. For the full subscription syntax and daemon lifecycle, see the Skills docs.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.