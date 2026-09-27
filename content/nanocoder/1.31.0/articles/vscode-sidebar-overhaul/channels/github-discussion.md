---
product: nanocoder
version: "1.31.0"
channel: github-discussion
title: "The Nanocoder VS Code extension, rebuilt as a native sidebar chat"
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 16710
---

Before v1.31, the Nanocoder VS Code extension was a thin layer on top of a terminal session. You started Nanocoder in your shell, ran `nanocoder --vscode`, and the extension connected over a local WebSocket to display your file edits as diffs and pipe diagnostics into the CLI. It was useful, and it is still there as an opt-in companion for people who prefer the TUI, but it never could be a real editor surface: the agent lived in another window, the chat transcript lived there too, and every editor interaction had to cross the WebSocket boundary. v1.31 rebuilds the extension as a native sidebar chat that runs the agent itself, in your editor, over the Agent Client Protocol. This article is the angle piece: what the sidebar actually is, what the move from WebSocket to ACP made possible, and what changed in v1.31 on top of that move.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The full feature is documented at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder) under `docs/features/vscode-extension.md`. This article is the angle piece, not a replacement for the docs.

## What the WebSocket companion was, and what it could not be

The companion shipped first. It was the smallest thing that could be useful: a fixed loopback port (`51820`) and a broadcast channel that the CLI wrote to whenever a tool call landed. The extension watched the channel and opened VS Code's diff viewer at the right paths. Approvals still happened in the CLI. Cancel still happened in the CLI. The transcript still lived in the CLI. The extension was a mirror, not a surface.

The shape had three consequences that v1.31 fixes:

- **The chat had to be a terminal.** Editing prompts meant moving the cursor into the terminal pane; copying a code block meant reaching for `/copy code` in the CLI; reading a thinking section meant scrolling the TUI. The extension was decorative until the model started writing files, which is when it became useful.
- **Any local process could drive the session.** The server bound a fixed port and accepted every upgrade, so any other local process or browser tab could deliver `{"type":"send_prompt", ...}` straight into the running agent and read every broadcast the server pushed out. v1.31 closes this: the companion server now mints a 256-bit bearer token per session and rejects unauthenticated cross-origin requests. The token is written to a discovery file (`vscode-server.json` in your Nanocoder config directory) and read by the extension; a file left behind by a CLI that is no longer running is ignored. SSH or other setups where the extension cannot read the discovery file copy `port` and `token` into `nanocoder.serverPort` and `nanocoder.serverToken`.
- **Nothing in the editor could speak to the model.** The CLI exposed the agent; the extension was downstream of it. Adding a code-lens command, or streaming subagent progress into the chat, or making file edits appear as chips above the composer meant either another protocol or a fork.

The companion is still there. `nanocoder.autoConnect` is now `false` by default; you turn it on if you want a terminal session mirrored into the editor, which is a useful mode for some workflows and an outdated one for most.

## What ACP changed

The Agent Client Protocol is the wire that lets the extension run the agent itself. The extension spawns and supervises `nanocoder --acp` as a background process; ACP carries messages, tool calls, tool results, permissions, and session lifecycle in both directions. The CLI is no longer a peer of the editor; it is a child process whose lifetime the editor owns.

Three things that change when you swap WebSocket for ACP:

- **The editor is the chat.** The transcript is a webview the extension renders, not the TUI's scrollback. Streaming, thinking sections, file-edit cards, task checklists, and per-turn work summaries all live in the sidebar. Stop, retry, copy-last-block, cancel-by-Escape: all keys in the editor. The CLI's interactive-only commands (`/init`, `/theme`, `/compact`, `/context-max`, `/usage`) explain, when you type them in the sidebar, that they need the terminal. They still work in the TUI.
- **Approvals are inline.** In modes that require confirmation, the tool card in the chat shows Approve / Deny buttons; the model does not stop in a different window. `ask_user` renders the question with one button per answer. The approval queue resolves its head on every answer, so a second answer from an already-settled prompt no longer consumes the next queued request unseen (v1.31 fixes this).
- **The webview can drive the agent.** Code lenses, `@` mention autocomplete, slash command autocomplete, model and mode pickers, file-change chips above the composer, drag-and-drop attachments, paste-image uploads: none of these were possible against a terminal session. They are all first-class actions on the webview side and ACP turns each one into a structured message on the agent side. The webview is a client. ACP is the protocol. The CLI is the agent.

There is one operational consequence worth knowing: the extension is versioned separately from the CLI. The discovery file in `vscode-server.json` now carries a `version` field that is actually checked (it was parsed and echoed back but never compared before v1.31), so a `v2` file written by a newer CLI is treated as missing by an older extension, which is the direction that matters given the two update independently. Older files, including ones written before the field existed, still load.

## What the sidebar actually is

The webview lives in VS Code's Activity Bar (the Nanocoder icon) and opens to a chat surface backed by a session. A few details that explain why it feels different from the TUI:

- **Native streaming.** Responses stream in as they generate, with reasoning in collapsible Thought sections inside the turn's work summary. Each uninterrupted stretch of thinking is one entry; the model going back to thinking after a tool call starts a new entry below it.
- **Per-turn work summaries.** Each turn's thoughts, tool calls, edit cards, and task plan are collected, in order, into one ordered, collapsible work summary, with the reply text kept outside it so the answer is never hidden. The header reads "Working..." while the turn runs, then "Worked for", "Stopped after" or "Failed after" plus the duration, and the summary folds away when the turn ends (unless you opened or closed it yourself). It reopens automatically when a tool inside it needs your approval. This is the v1.31 change: a single ordered grouping per turn, replacing the older layout where the same turn's thinking, tool cards, and edit cards each sat at the same indent and the user had to skim them all to find the answer.
- **File-change chips above the composer.** Each file the agent finishes writing is added to a row above the composer as a chip; click one to open the file as it stands now, the `x` dismisses it. Chips for files the agent changed are dashed to set them apart from the files you attached yourself: clicking one opens the file as it stands now, the `x` dismisses it, and unlike your own attachments they are not sent along with your next message and are not cleared when you send it. Starting or resuming a conversation clears them. The row follows the rest of the file lifecycle too: deleting a file takes its chip away (including one you attached yourself, which would otherwise expand to nothing on your next message), and renaming one moves its chip to the new path. Only calls that actually completed count, so a delete you denied leaves the row exactly as it was. A turn that touches many files fills the row rather than growing the composer: it scrolls once it is a few lines deep, and a **Clear N changed files** control below it dismisses the whole run at once. That control only clears what the agent changed; files you attached stay until you remove them yourself.
- **Code lenses.** Every function, method, constructor, and class in an open editor carries `Explain Code` and `Generate Tests` links. Clicking one reveals the Nanocoder chat view and sends a prompt with that symbol's source inlined. Turn them off with `nanocoder.codeLens` if they get in the way.
- **Live subagent progress.** When the AI delegates to a subagent, the subagent's tool card updates live with the subagent's name, token usage, tool count, and the last tool it used. Delegated runs render into the same work summary as the parent turn, with their progress visible while they work, not after.
- **Task checklist.** When the AI plans work with the task tool (`write_tasks`), a Tasks card appears in that turn's work summary showing each task with its status (open circle for pending, arrow for in progress, check for completed), plus a progress count in the header. The card updates in place as the AI works through the list.
- **Agent actions ahead of execution.** Every tool call in a turn is announced before the batch runs, so the chat shows the agent's queued work rather than only what it has already finished. Each entry moves through queued, then running, then done.
- **Cancellation is a chat key.** The send button becomes a stop button while a turn is running. Pressing it, or pressing Escape anywhere in the chat panel, cancels the current tool, skips any queued tools, and ends the turn. ACP has no `cancelled` tool status, so a cancel arrives as `failed` with `Cancelled by user` in the raw output; the webview matches that case-insensitively (it was case-sensitive and never hit it before v1.31).
- **Retry and copy per response.** Each assistant response has a clipboard button (raw markdown) and a retry button. Retry removes the response from the chat, truncates the conversation back to that prompt, and resends, so the model does not see the discarded answer. Retry is unavailable while a turn is running. `Cmd+Alt+Shift+C` (`Ctrl+Alt+Shift+C` on Windows/Linux) copies the last code block from the previous assistant response, the same as typing `/copy code`.

## The grouped work summary in v1.31

The headline change worth dwelling on is the work summary, because it is the difference between "chat in an editor" and "chat you can read". The pre-1.31 layout showed a turn as a sequence of cards at the same indent: a thought block, a tool card, another thought, an edit card, the answer, the next thought. The answer and the work were visually intermixed, and folding any one of them folded nothing else, so a user scrolling a long turn was reading the entire transcript.

The new layout collects the work into one ordered, collapsible block per turn and keeps the final answer visible. The summary has a header that reports duration and status: "Worked for", "Stopped after" or "Failed after" plus how long the turn took. It folds away when the turn ends, unless you opened or closed it yourself. It reopens automatically when a tool inside it is waiting on an approval.

Three small things that come with the summary:

- **The summary is the unit of collapse.** Individual cards do not collapse independently; the whole summary does. That is intentional. Per-card collapse would re-create the same skimming problem at a smaller scale.
- **The reply text stays outside.** The model's final answer is its own region beneath the summary. A folded summary hides the work, not the answer. An open summary shows the work above the answer. The two never share a fold state.
- **Approvals reopen it.** A pending approval is a tool card inside the summary, and a pending approval needs to be visible. The summary reopens for it. Once you answer, the summary folds again unless you left it open.

This is what made the v1.31 review gate usable in Architect mode at all: the review bar can show you what the turn did because the work is grouped and the answer is separate. The sidebar chat inherits the same shape, even in Normal mode, because the same problem exists in both places.

## Settings, model picker, and the Configuration popover

The model picker sits on the composer's bottom row and shows the current model. Next to it, the sliders button opens a Configuration popover with the Provider and Mode selectors. Switching provider refreshes the model list automatically and reconciles the model if the current one is not available on the new provider. Mode and model choices persist to VS Code settings; the mode persists into `nanocoder.mode`, which sidebar chat sessions start in (Auto-Accept by default). Terminal CLI sessions ignore this setting and use `nanocoder.defaultMode` instead.

The gear icon in the view title bar opens a Settings tab in the sidebar that reads and writes the same files as the CLI (project-level `agents.config.json` first, then your global config directory), resolved the same way. It covers providers (with masked API keys), MCP servers, the always-allow list, default mode, auto-compact, reasoning traces, session autosave, token usage footers, and web search configuration. Anything the tab does not cover lives in `agents.config.json`, which `Nanocoder: Open Configuration` opens (project-level first, then global).

`Nanocoder: Restart Nanocoder Agent Process` is the operational escape hatch: restart the background `nanocoder --acp` process after changing config or upgrading the CLI.

## Sessions, history, and smart titles

Sessions persist to disk across restarts and are listed newest first from the clock icon in the view title bar. Click one to resume; the full thread replays, including thinking sections and completed tool cards. Rename from the History view; a manually set name is preserved when the session is reopened, including from the terminal CLI, and is never overwritten by an auto-generated title.

Smart titles ship in v1.31 and they run in the ACP agent, so they apply to the VS Code extension and other ACP clients; the CLI keeps its heuristic title. A session keeps its opening prompt as the title by default, and when that prompt is too thin to be useful the agent generates a descriptive name once, after the first turn that ran a tool or the first follow-up message. Manual renames are never overwritten. Existing sessions are retitled from their first message on their next autosave, which is a one-time visible reshuffle of the history list.

The token cost of a title is billed by the provider but is not counted in `/usage`, since the call is made outside the conversation loop that builds usage records. Set `sessions.smartTitles: false` to turn the feature off; set `sessions.titleModel` / `sessions.titleProvider` to point titling at a cheaper or local model. Pointing `titleProvider` at a different provider sends it the opening user turns and a summary of the tools that ran, which includes file paths and bash command strings.

The same fix-up that made smart titles safe also fixed the CLI's autosave: it used to derive the session title from the latest user message and rewrite it on every save, overwriting titles in the store the VS Code extension reads from. v1.31 closes that. Closes #808.

## Where this leaves the extension

The shape v1.31 settles into is: a native sidebar chat that runs the agent itself over ACP, with a single grouped work summary per turn, file-change chips above the composer, code lenses for in-editor prompts, live subagent progress inside the work summary, and a Settings tab that reads and writes the same config files as the CLI. The legacy WebSocket companion is still available for people who prefer it, now opt-in via `nanocoder.autoConnect`, and now authenticated with a per-session bearer token. The two are separate conversations; the GUI does not see what a terminal session is doing.

The operational reading is straightforward. If you have been running `nanocoder --vscode` in a terminal to get the extension's diffs, you can stop: open the sidebar, the extension will spawn `nanocoder --acp` itself, and the chat is in your editor. If you want the TUI, the companion is one setting away. If you want both running at once for some reason, the two do not share session state, so be explicit about which one you are talking to.

The webview is versioned separately from the CLI, which means the CLI can ship the new work in the chat without waiting for an extension release, and the extension can ship UI work without waiting for a CLI release. The discovery file's `version` field is what makes the contract honest.

Full docs and changelog at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder). If anything is broken or surprising, open an issue or drop a note in Discord.
