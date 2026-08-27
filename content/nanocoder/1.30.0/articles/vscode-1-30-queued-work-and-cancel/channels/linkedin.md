---
product: nanocoder
version: "1.30.0"
channel: linkedin
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 1800
---

Nanocoder 1.30.0 ships a stack of small fixes to the VS Code extension that add up to a much more reliable chat panel. Four threads run through the release, and each is the kind of thing you only notice when it is broken.

First, the chat panel now surfaces tool calls as a queued, running, done checklist. Every call in a turn is announced before the batch runs, so you can see what is in flight and what is queued behind it. Rows are labelled in plain English (Reading source/x.ts, Running pnpm test) instead of raw tool names. Queued edits say Edit x.ts until they actually run, and the Open Diff action only becomes clickable once the diff exists. The checklist is scoped to the turn that produced it, so cancelling one call settles every queued row in that turn rather than leaving the ones behind it spinning.

Second, Escape actually cancels now. The listener is on the webview's document, so it fires even when focus has moved to a tool card, a button, or the streaming area. There is also a nanocoder.cancel command in the Command Palette. The fix on the agent side rotates the AbortController at the start of the turn instead of when a cancel arrives, so a cancel that lands early in the prompt setup no longer hands the turn an unaborted controller. Cancelling while a tool is waiting for approval no longer wedges the chat: any outstanding permission requests are now answered with a cancelled outcome and their approval cards are dismissed, so the next message goes through.

Third, session renaming rides on a new renameSession ACP extMethod. ACP's core protocol does not include a client-driven title, so the extension used to overwrite a renamed session on the next autosave. The new handler in the CLI's ACP agent validates the params, runs the rename through the session manager, and returns the updated title. The agent now knows the title was set by the client and the autosave can no longer overwrite it. Creating a new chat or resuming a session from the History list also returns to the active chat view instead of leaving the panel stuck on the session list.

Fourth, the extension can finally start the CLI on Windows and for users behind Node version managers. On Windows, where.exe lists npm's unexecutable extensionless shim before the .cmd, and spawning a .cmd has been blocked by CVE-2024-27980 without shell: true. The extension now ranks where.exe matches by extension, resolves the JS entrypoint behind the shim, and runs it through node directly. On macOS and Linux, the extension asks the user's interactive login shell for its PATH (so nvm, Volta, fnm, pnpm, and bun initialise from .zshrc or .bashrc) and falls back to a hard-coded directory scan when which still fails. The child process's PATH is enriched with the CLI's directory only when a co-located node is present, so a user's version-manager Node is never shadowed.

Full write-up at https://github.com/Nano-Collective/nanocoder.