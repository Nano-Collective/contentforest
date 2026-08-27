---
product: nanocoder
version: "1.30.0"
channel: github-discussion
title: "VS Code in 1.30: queued work, real cancel, CLI you can find"
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 18100
---

The VS Code extension is where most of Nanocoder's user-visible changes in 1.30 land. Two of the release's bigger fixes live in the chat panel itself: the way tool calls are surfaced as a queued, running, done checklist, and the way Escape and a new `nanocoder.cancel` command actually tear down an in-flight request and clear any pending approvals. A third fix moves session renaming onto a proper ACP extension method instead of a UI-only hack. And a fourth set of fixes, in the extension's startup path, finally lets Windows users and Node version manager users (NVM, Volta, fnm, pnpm, bun) start the extension at all. This article is a walk through the four pieces, with the source.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source: [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Queued work, in plain English

Before 1.30, the chat panel showed tool calls only after they finished. A long batch (read this file, run that test, edit three files) would render as a list of cards that all flipped from spinner to result at once, with no indication anything had been queued. A user looking at the panel during the batch had no way to tell which call was running, which were still queued behind it, and which had already returned. Worse, a `diff_edit` card showed up as "Edit applied" the moment the tool was announced, and its Open Diff action was clickable before any diff existed. Clicking through raised "Change not found".

The fix changes two things. First, every tool call in a turn is announced before the batch runs, so the checklist reads `queued` → `running` → `done`. Second, queued rows are labelled in plain English: "Reading source/x.ts", "Running pnpm test", "Edit source/y.ts". Raw tool names are kept for the developer-facing transcript but no longer surfaced as the row label.

The edit-card behaviour is fixed too. Queued edits say "Edit x.ts" until they actually run, and the Open Diff action only becomes clickable once the diff exists. The card can no longer claim an edit was applied before the tool returned. The same fix is what unblocks failed-edit recovery: before, the panel matched tool names the agent never sends, which made the edit card unreachable and left failed edits spinning forever. Now every queued call has its own card from the moment it is announced.

The turn scope is also fixed. Before 1.30 the task checklist was one card reused for the whole session. A new turn would inherit whatever the previous turn left behind, which is why cancelling one tool in a batch left the ones behind it spinning in the same card. The checklist is now scoped to the turn that produced it. Cancelling settles every queued row in that turn rather than only the one that was running, which also fixes the same stall in other ACP clients such as Zed.

## Escape, and why it had to be wired to the document

Pressing Escape in the chat panel now cancels an in-flight LLM request, mirroring the Stop button. The change sounds small; the implementation is the part that matters.

Two pieces have to be true for cancel to work. The frontend has to fire on the right event, and the backend has to actually stop the model. Both were broken in different ways.

On the frontend, the Escape listener was registered on the chat input only. As soon as focus moved to a tool card, a button, the streaming response area, or any other widget inside the webview, the listener stopped firing. The key was bound but unbound the moment the user looked at anything. The listener is now registered on the webview's `document`, so it fires regardless of which element inside the panel has focus. There is also a `nanocoder.cancel` command added to the Command Palette, for users who reach for that muscle memory instead of Escape.

On the backend, the fix rides on a separate bug. `AcpSession.cancel()` aborted the current controller and immediately replaced it with a fresh one. A cancel that landed in the window between the user pressing Enter and the turn reading the abort signal would hand the turn an unaborted controller, and the stop was lost. The controller is now rotated when a turn begins instead of when a cancel arrives, so the signal always reaches a controller that was active at the start of the turn. Cancelling now shows a clean "Cancelled by user" note inline in the chat instead of an error toast.

There is also a related UI fix that falls out of the same audit. Cancelled tool cards previously rendered with the error icon. ACP has no `cancelled` tool status, so a cancel arrives as `failed` with "Cancelled by user" in the raw output. The webview matched that string case-sensitively against `cancelled` and never hit it. The match is now case-insensitive, so a cancelled tool card renders with the neutral cancelled indicator and the user can distinguish a deliberate cancel from a genuine error at a glance.

## Pending approvals: the wedged chat

This is the bug that made Escape feel broken even when it was working. The previous chat wedged in a specific way: a tool is waiting for approval, the user hits Escape or clicks Stop, and the chat goes silent. The next message the user types is refused with "Please approve or deny the pending tool before sending a new message", until the window was reloaded.

The cause was that the pending permission resolver was left in place after a cancel. The extension kept reporting an outstanding prompt to the agent, and because that prompt never resolved, every later message was rejected at the gate. Cancelling (or starting a new chat) now answers any outstanding permission requests with a cancelled outcome and dismisses their approval cards. The same fix applies on reconnect: if the agent process restarts while a permission request is still in flight, the extension resolves those requests as cancelled rather than leaving them dangling.

The fix is what makes the visible UX change work. The previous Escape behaviour could be patched by reloading the window; the new one leaves the chat in a state where the user can immediately type the next thing.

## Renaming sessions over ACP

Renaming a session in the History view used to be a local UI trick: the extension renamed its own title for display, but the agent's session record kept whatever title the autosave had last derived from the first message. Reopening the session in the CLI, or restarting the extension, brought back the auto-derived name. The flag `titleManuallySet` was supposed to stop that, but the CLI's ACP agent rebuilt the session record field-by-field on every save and wasn't carrying it through, so the flag was dropped from disk after the next message and the autosave overwrote the user's name.

The 1.30 fix moves renaming onto a proper ACP extension method. The CLI's ACP agent now exposes `renameSession` as an `extMethod`, which is the protocol's sanctioned escape hatch for client-driven metadata. The handler is in `source/acp/acp-agent.ts`:

```ts
async extMethod(
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (method === 'renameSession') {
    const sessionId = params.sessionId;
    const title = params.title;
    if (typeof sessionId !== 'string' || typeof title !== 'string') {
      throw new Error(
        'renameSession requires string sessionId and title params',
      );
    }

    await sessionManager.initialize();
    const updated = await sessionManager.renameSession(sessionId, title);
    if (!updated) {
      throw new Error(`Session not found on disk: ${sessionId}`);
    }
    logger.info(`ACP extMethod renameSession: ${sessionId} -> "${title}"`);
    return {title: updated.title};
  }

  throw new Error(`Unknown extension method: ${method}`);
}
```

ACP's core methods don't include a way for the client to rename a session (the title is agent-driven, from the latest message), so `extMethod` is the right surface for it. The handler validates the params, runs the rename through the existing session manager, and returns the updated title. The extension's `AcpClient.renameSession` now calls `this.connection.extMethod('renameSession', {sessionId, title})` and surfaces a VS Code error notification if the agent rejects the call. The CLI's autosave can no longer overwrite the user's name, because the agent now knows the name was set by the client.

A second session-management fix landed alongside this. Creating a new chat or resuming a session from the History list used to leave the panel stuck on the session list. It now returns to the active chat view once the session is ready, so resuming does not require an extra click.

## CLI discovery for Windows and Node version managers

The fourth cluster of fixes is in the extension's startup path. Before 1.30, the extension would silently fail to start the CLI on Windows, and on macOS/Linux it would silently fail for anyone whose Node install lived behind a version manager. The user would see the panel stuck on "Connecting" and nothing in the UI would tell them why.

The Windows path is a chain of two bugs. First, `where.exe nanocoder` lists both the extensionless POSIX shim and the `nanocoder.cmd` Windows shim, and it lists the extensionless one first. That file is a shell script Windows cannot execute, so spawning it directly fails with ENOENT. The discovery now ranks `where.exe` matches by extension: `.exe`, then `.cmd`, then `.bat`, then an extensionless fallback. Second, spawning a `.cmd` also fails with EINVAL because Node has refused to run `.cmd` and `.bat` files without `shell: true` since CVE-2024-27980. The extension resolves the JS entrypoint behind the shim and runs it directly through `node <script>` with `shell: false`, instead of trying to execute the shim. The shim body is read with a 64 KB cap, the `%~dp0%...%` or `$basedir/...` prefix is matched, and the referenced script is resolved relative to the shim's own directory. A shim whose target escapes that directory is treated as tampered and the extension falls back to a quoted shell spawn. The whole planning step lives in `planCliSpawn` in `source/vscode/cli-path-discovery.ts`.

The version-manager path is a different bug. VS Code launched from the macOS dock or a Linux desktop entry inherits launchd or systemd's minimal PATH, which does not include the `~/.nvm/versions/node/*/bin`, `~/.volta/bin`, `~/.local/share/fnm/aliases/default/bin`, `~/.local/share/pnpm` (or `~/Library/pnpm` on macOS), or `~/.bun/bin` directories. Running `which nanocoder` from the extension host returns nothing, and the panel sits at "Connecting". The fix has two halves. First, the extension asks the user's interactive login shell for its PATH (`shell -ilc 'printf ... $PATH'`), so nvm and friends that initialise in `.zshrc` or `.bashrc` are picked up. Second, when the login-shell path still does not resolve the binary, a fallback directory scan walks the version-manager install roots directly: NVM (newest version first), Volta, fnm, pnpm global, Bun, n, npm-global, plus common system prefixes on macOS and Linux. The fallback list is in `buildFallbackCandidates` in the same file.

There is one more piece worth flagging, because it is the kind of thing that turns a working fix into a regression. The child process's PATH is enriched with the CLI's directory only when a co-located `node` binary is present. Prepending a directory that ships its own `node` would shadow the user's version-manager Node and break tools downstream. The `nodeExistsAlongside` check is the guard against that.

The whole discovery flow is `findCliPath` in `plugins/vscode/src/cli-discovery.ts`, which composes the configured custom path, the local-development `dist/cli.js` fallback, the login-shell `which`/`where`, and the version-manager directory scan into a single ordered lookup. Spawn failures are caught and reported in the Nanocoder output channel instead of being swallowed as an unhandled rejection that leaves the UI stuck on "Connecting".

## What the four fixes share

Each of these is, on the surface, a UX change. The shared shape underneath is the same: the visible behaviour was a small detail the team had carried for a while, and the actual fix was a layering fix. The queued-work card needed the panel to announce calls as they arrive, not just render them when they return. Escape needed a listener on the webview document and a controller rotated at the right moment. Cancelling a pending approval needed the permission resolver to be torn down, not just the abort signal to fire. Renaming a session needed the agent and the client to agree on who owns the title, and ACP `extMethod` is the place that agreement can live. CLI discovery needed the spawn path to be smart about shims and the PATH lookup to be smart about launchd.

In every case the fix is small in lines and large in reliability. That is the part worth highlighting if you are upgrading and wondering whether 1.30 affects you: it does, even if the release notes undercount it.

## Install

```bash
npm install -g @nanocollective/nanocoder
```

Or update the VS Code extension from the marketplace. The CLI is at version 1.30.0; the extension ships against the same release.

If anything in the chat panel or the startup flow is still broken on your machine, please open an issue or drop a note in Discord with the platform, the version manager (if any), and the contents of the Nanocoder output channel. Full changelog at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).