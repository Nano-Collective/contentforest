---
product: nanocoder
version: "1.27.0"
channel: linkedin
title: "How Nanocoder's daemon replaces the scheduler"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.27.0 removes the old scheduler and replaces it with a per-project background daemon. This is what changed and why it matters.

**What the daemon does**

It runs as a long-lived background process, completely independent of the interactive TUI. It watches the file system and fires cron schedules, waking skill subscriptions when their trigger conditions match. The TUI does not need to be open for any of this to happen.

**Concurrency cap**

A `file.changed` subscription that matches 1,000 files in 200ms will dispatch one run and drop the other 999. The `BackpressureDispatcher` enforces a per-subscription concurrency cap of 1 and a 500ms trailing debounce on file events. Cron events dispatch immediately with no debounce.

**Headless mode by default**

Triggered runs execute in `headless` mode by default (autonomous, no `ask_user`, no foreground confirmations). Set `confirm: true` on a subscription to run in `plan` mode instead, where the subagent proposes without applying.

**Lockfile lifecycle**

The daemon writes `.nanocoder/daemon.json` on boot (PID, socket path, start time). Stale lockfiles (dead PID) are reaped automatically. Atomic writes via rename-from-tmp. On Windows, the socket is a named pipe at `\\.\pipe\nanocoder-daemon-<hash>`.

**IPC**

The socket is an `AF_UNIX` stream at `.nanocoder/daemon.sock` on macOS and Linux. Protocol is newline-delimited JSON with `ping`, `listSubscriptions`, and `shutdown` methods. `shutdown` triggers a graceful drain; `SIGTERM` is only a fallback on Windows where it would otherwise be force-kill.

**Migration**

The old `.nanocoder/schedules.json` is gone. Move each cron entry into the targeted command's `subscribe:` block. Presence of the file on boot triggers a loud deprecation warning, but the file is no longer read.

The source is at https://github.com/Nano-Collective/nanocoder.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.