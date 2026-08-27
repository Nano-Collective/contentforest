---
product: nanocoder
version: "1.30.0"
channel: reddit
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 5800
---

We pushed Nanocoder 1.30.0 today. The headline is `/settings` consolidation and a `/commit` slash command, but the work I want to talk about here is what changed in the VS Code extension's chat panel and the startup path. Four threads, each of which fixes a thing users had been quietly working around for a while.

## The chat panel now shows queued work

Before 1.30 the chat panel rendered tool calls only after they returned. A batch that took a few seconds would flip from spinner to result in a single step, with no per-call state. A queued edit also claimed "Edit applied" before it ran, and clicking its Open Diff action raised "Change not found" because the diff did not exist yet.

The fix has two parts. First, every tool call in a turn is announced before the batch runs, so the checklist reads queued to running to done. Rows are labelled in plain English: "Reading source/x.ts", "Running pnpm test", "Edit source/y.ts". Second, queued edits say "Edit x.ts" until they actually run, and the Open Diff action only becomes clickable once the diff exists. The checklist is now scoped to the turn that produced it, so cancelling one tool settles every queued row in that turn instead of leaving the ones behind it spinning.

## Escape now actually cancels

Pressing Escape in the chat panel now cancels an in-flight request. The implementation is the interesting part because it had to change in two places.

On the frontend, the listener was registered on the chat input only. As soon as focus moved to a tool card, a button, or the streaming area, the listener stopped firing and Escape went back to being inert. The listener is now on the webview's document, so it fires regardless of which element has focus. There is also a `nanocoder.cancel` command in the Command Palette for users who reach for that instead.

On the agent side, `AcpSession.cancel()` aborted the current controller and immediately replaced it with a fresh one. A cancel that landed during the prompt's file-reference resolution would hand the turn an unaborted controller, and the stop was lost. The controller is now rotated when a turn begins, so the abort signal always reaches a controller that was active at the start of the turn. Cancelling now shows a clean "Cancelled by user" note inline in the chat instead of an error toast.

The same audit turned up a related bug. ACP has no `cancelled` tool status, so a cancel arrives as `failed` with "Cancelled by user" in the raw output, and the webview's case-sensitive check never hit it. Cancelled tool cards used to render with the error icon. The match is now case-insensitive, so cancelled cards render with a neutral indicator and you can tell a deliberate cancel from a genuine error at a glance.

## The pending-approval wedge

This is the bug that made Escape feel broken even when it was wired correctly. If a tool was waiting for approval and you cancelled, the pending permission resolver was left in place. The extension kept reporting an outstanding prompt to the agent, and every later message was rejected with "Please approve or deny the pending tool before sending a new message" until the window was reloaded.

Cancelling (or starting a new chat) now answers any outstanding permission requests with a cancelled outcome and dismisses their approval cards. The same fix applies on reconnect: if the agent process restarts while a permission request is still in flight, the extension resolves those requests as cancelled rather than leaving them dangling. The next message goes through immediately.

## Renaming sessions properly

Renaming a session in the History view used to be a local UI trick. The extension renamed its own display title, but the agent's session record kept the auto-derived title from the first message. The flag `titleManuallySet` was supposed to stop the autosave from overwriting it, but the CLI's ACP agent rebuilt the session record field-by-field on every save and wasn't carrying the flag through. After the next message the flag was dropped from disk and the autosave overwrote the user's name.

ACP's core protocol does not include a way for the client to rename a session (the title is normally agent-driven, from the latest message), so 1.30 adds a `renameSession` extension method (`extMethod`) to the CLI's ACP agent. The handler in `source/acp/acp-agent.ts` validates the params, runs the rename through the existing session manager, and returns the updated title. The extension calls `this.connection.extMethod('renameSession', {sessionId, title})` and surfaces a VS Code error notification if the agent rejects the call. The agent now knows the title was set by the client, so the autosave can no longer overwrite it.

A second session-management fix landed in the same area. Creating a new chat or resuming a session from the History list used to leave the panel stuck on the session list. It now returns to the active chat view once the session is ready, so resuming does not require an extra click.

## The extension can finally start the CLI on Windows, and behind NVM/Volta/fnm/pnpm/bun

The fourth cluster of fixes is in the startup path, and it is what most Windows users will notice on upgrade. Before 1.30 the extension would silently fail to start the CLI on Windows, leaving the panel stuck on "Connecting" with no error in the UI. The same class of bug affected macOS and Linux users behind Node version managers.

The Windows path was two bugs in a row. First, `where.exe nanocoder` lists both the extensionless POSIX shim and the `nanocoder.cmd` Windows shim, and it lists the extensionless one first. That file is a shell script Windows cannot execute, so spawning it failed with ENOENT. The discovery now ranks `where.exe` matches by extension: `.exe`, then `.cmd`, then `.bat`, then an extensionless fallback. Second, spawning a `.cmd` directly has been blocked by EINVAL since CVE-2024-27980 without `shell: true`. The extension resolves the JS entrypoint behind the shim (matched from the shim body's `%~dp0%...%` or `$basedir/...` prefix, capped at 64 KB) and runs it directly through `node <script>` with `shell: false`. If the shim's referenced script escapes its own directory the extension treats it as tampered and falls back to a quoted shell spawn.

The version-manager path was a different bug. VS Code launched from the macOS dock or a Linux desktop entry inherits launchd or systemd's minimal PATH, which does not include `~/.nvm/versions/node/*/bin`, `~/.volta/bin`, `~/.local/share/fnm/aliases/default/bin`, `~/.local/share/pnpm` (or `~/Library/pnpm` on macOS), or `~/.bun/bin`. `which nanocoder` from the extension host returned nothing, and the panel sat at "Connecting". The fix has two halves. The extension asks the user's interactive login shell for its PATH (`shell -ilc 'printf ... $PATH'`), so nvm and friends that initialise in `.zshrc` or `.bashrc` are picked up. When the login-shell path still does not resolve the binary, a fallback directory scan walks the version-manager install roots directly: NVM (newest version first), Volta, fnm, pnpm global, Bun, n, npm-global, plus common system prefixes on macOS and Linux.

One last guard. The child process's PATH is enriched with the CLI's directory only when a co-located `node` binary is present. Prepending a directory that ships its own `node` would shadow the user's version-manager Node and break tools downstream.

The whole discovery flow is `findCliPath` in `plugins/vscode/src/cli-discovery.ts`, which composes the configured custom path, the local-development `dist/cli.js` fallback, the login-shell `which`/`where`, and the version-manager directory scan into a single ordered lookup. Spawn failures are caught and reported in the Nanocoder output channel instead of being swallowed as an unhandled rejection that left the UI stuck on "Connecting".

## Install

```bash
npm install -g @nanocollective/nanocoder
```

Or update the VS Code extension from the marketplace. If anything in the chat panel or the startup flow is still broken on your machine, please open an issue or drop a note in Discord with the platform, the version manager (if any), and the contents of the Nanocoder output channel. Full changelog at https://github.com/Nano-Collective/nanocoder.