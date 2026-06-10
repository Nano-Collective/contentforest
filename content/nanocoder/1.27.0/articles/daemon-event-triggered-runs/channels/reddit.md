---
product: nanocoder
version: "1.27.0"
channel: reddit
title: "How Nanocoder's daemon replaces the scheduler"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.27.0 shipped a per-project daemon that replaces the old scheduler. Here is what changed and why the new model is designed the way it is.

**The old scheduler ran inside the TUI.** File watching and cron ticks only worked while the TUI was open. Triggered runs shared the TUI's mode, with no way to run autonomously. The scheduler state lived in a separate `.nanocoder/schedules.json` that nothing else touched.

**The daemon runs independently.** It starts with `nanocoder daemon start` and installs as a user-level service via `nanocoder daemon install` (launchd on macOS, systemd on Linux, Task Scheduler on Windows). It keeps running after you close the TUI.

**Lockfile and single-instance guarantee.** The daemon writes `.nanocoder/daemon.json` on boot containing PID, socket path, and start time. Before starting, it checks for an existing lockfile. Dead PIDs are reaped automatically using `process.kill(pid, 0)` as a probe. A stale lockfile from a crashed daemon does not block a fresh start. Writes go to a `.tmp` sibling and rename in place for atomicity.

**AF_UNIX socket IPC.** On macOS and Linux the daemon listens at `.nanocoder/daemon.sock`. The protocol is newline-delimited JSON with three methods: `ping`, `listSubscriptions`, `shutdown`. The `shutdown` method triggers a graceful drain of the event loop (watcher stop, cron stop, IPC server close, lockfile removal) and is the correct stop path on Windows, where `SIGTERM` would otherwise be force-kill.

**File watching via chokidar.** The watcher excludes `node_modules`, `.git`, and `.nanocoder/` by default. The `.nanocoder/` exclusion is important. Triggered runs write checkpoints under `.nanocoder/checkpoints/`. If that directory were watched, each checkpoint would fire a `file.changed` event, which would trigger another run, creating a feedback loop. The tree is loaded once at boot and is not hot-reloaded.

**Concurrency cap and debouncing.** The `BackpressureDispatcher` applies two protections. Per-subscription concurrency of 1 means a `git pull` producing 1,000 file-change events dispatches one run and drops the other 999. A trailing-edge debounce of 500ms on `file.changed` events means a linter that touches 50 files fires one run at the end of the burst, not 50 separate ones. Cron events bypass the debounce and dispatch immediately.

**Headless mode.** Triggered runs execute in `headless` mode by default (autonomous, no `ask_user`, no foreground prompts). This is the key difference from the removed scheduler, which ran inside the TUI and could not opt out of user-facing mode. If a subscription needs human review before applying changes, set `confirm: true` on it. The dispatcher then runs in `plan` mode instead: the subagent proposes what it would do without applying any mutations. Checkpoints are skipped for plan-mode runs since there is nothing to revert.

**Migration from schedules.json.** The old scheduler is gone. `.nanocoder/schedules.json` is no longer read. If it is present on boot, a loud deprecation warning appears. The fix is to move each entry into the targeted command's `subscribe:` block:

```markdown
---
description: Monday morning summary.
subscribe:
  - kind: schedule.cron
    cron: "0 9 * * MON"
---

Summarize last week's commits...
```

Then run `nanocoder daemon start` to activate the subscription.

The source is at https://github.com/Nano-Collective/nanocoder. The Skills docs cover the full subscription syntax and daemon lifecycle.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.