---
product: nanocoder
version: "1.31.0"
channel: reddit
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 8916
---

We rewrote the Nanocoder VS Code extension in v1.31 and I want to walk through what changed and why, because the before-state had been bugging us for a while.

The before-state, briefly: the extension was a WebSocket mirror of a terminal session. You started `nanocoder --vscode` in your shell and the extension connected on a fixed loopback port (51820) to display file edits as diffs and pipe diagnostics into the CLI. Useful for diffs; not useful as a chat surface. The transcript lived in the TUI, approvals lived in the TUI, cancel lived in the TUI. If you wanted a code lens to ask the model about a function, you could not, because the editor side had no way to drive the agent. The extension was downstream of the CLI; it could only watch.

There were three things that bothered us about this shape:

1. **The chat had to be a terminal.** Editing prompts, copying code blocks, reading thinking sections: all in the TUI. The extension was decorative until the model wrote a file, which is when it became useful.
2. **Any local process could drive the session.** The companion server bound a fixed port and accepted every upgrade, so any other local process or a browser tab could deliver a `send_prompt` straight into a running agent and read every broadcast the server pushed out. That was not a hypothetical. It was a default.
3. **Nothing in the editor could speak to the model.** A code lens command, or streaming subagent progress into the chat, or making file edits appear as chips above the composer: none of it was possible against a terminal session. The agent was behind a one-way mirror.

The v1.31 rebuild moves the extension from "mirror of a terminal session" to "client of the agent". The extension now spawns and supervises `nanocoder --acp` itself, over the Agent Client Protocol. ACP carries messages, tool calls, tool results, permissions, and session lifecycle in both directions. The CLI is now a child process whose lifetime the editor owns. The webview is a real client.

A few things fall out of that change that we are excited about.

**The chat lives in the editor.** Streaming, thinking sections, file-edit cards, task checklists, per-turn work summaries, model picker, mode picker, slash-command autocomplete: all in the sidebar. `Cmd+Alt+Shift+C` copies the last code block. Escape cancels the turn. The send button becomes a stop button while a turn runs. You can stop using the terminal for the model entirely.

**Approvals are inline.** In modes that require confirmation, the tool card in the chat shows Approve / Deny buttons. `ask_user` shows the question with one button per answer. We also fixed an approval-queue defect where a second answer from an already-settled prompt would consume the next queued request and resolve it unseen, so an approval could effectively auto-approve a tool the user was never shown. The prompt now ignores any answer after the first.

**Each turn's work is grouped into one ordered, collapsible summary, with the answer outside it.** This is the layout change I personally wanted for a long time. The pre-1.31 layout showed a turn as a sequence of cards at the same indent, with the answer interleaved between them. You had to scroll past the whole transcript to find what the model said. The new layout collects thoughts, tool calls, edit cards, and the task plan into one block per turn and keeps the reply text outside, so the answer is never hidden. The summary reports duration and status ("Worked for 12s", "Stopped after 30s", "Failed after 4s") and folds away when the turn ends, unless you opened it. It reopens automatically when a tool inside it is waiting on your approval.

The unit of collapse is the summary, not the individual card. Per-card collapse would re-create the same skimming problem at a smaller scale. Folding is one decision per turn, which matches the granularity at which you actually want to review the work.

**File-change chips above the composer.** Each file the agent finishes writing appears as a chip above the input. Click one to open the file as it stands now, the `x` dismisses it. Files the agent changed are dashed, to set them apart from files you attached yourself: clicking one opens the file, the `x` dismisses it, and unlike your own attachments these are not sent along with your next message and are not cleared when you send it. The row follows the rest of the file lifecycle: deleting a file takes its chip away, renaming one moves its chip to the new path. Only completed calls count, so a denied delete leaves the row exactly as it was.

A turn that touches many files fills the row rather than growing the composer: it scrolls once it is a few lines deep, and a "Clear N changed files" control below it dismisses the whole run at once. That control only clears what the agent changed; files you attached stay until you remove them yourself.

**Code lenses on every function, method, constructor, and class.** `Explain Code` and `Generate Tests` links above each symbol in an open editor. Click one and the chat opens with a prompt and the symbol's source inlined. Off with `nanocoder.codeLens` if they get in the way.

**Live subagent progress.** When the AI delegates, the subagent's tool card updates live with the subagent's name, token usage, tool count, and the last tool it used. Delegated runs render into the same work summary as the parent turn, with their progress visible while they work, not after they finish. This was the use case I cared about most: the previous behavior surfaced the subagent only as a final result, with no signal during the run, so a multi-minute delegation felt like nothing was happening.

**Task checklist.** When the AI plans work with the task tool, a Tasks card appears in that turn's work summary showing each task with status (pending / in progress / done), plus a progress count. The card updates in place as the AI works through the list.

**Cancellation is a chat key.** Escape anywhere in the chat panel cancels the current tool, skips any queued tools, and ends the turn. We also fixed a case-sensitivity defect in the cancel matcher: ACP has no `cancelled` tool status, so a cancel arrives as `failed` with `Cancelled by user` in the raw output, but the webview was matching `cancelled` case-sensitively and never hit it. Now it does.

The legacy WebSocket companion is still there for people who prefer the TUI, but it is now opt-in via `nanocoder.autoConnect`. The security shape is fixed: the server now mints a 256-bit bearer token per session and rejects unauthenticated cross-origin requests, and the token is written to a discovery file (`vscode-server.json` in your Nanocoder config directory) rather than being predictable from the port. For SSH or other setups where the extension cannot read the discovery file, copy `port` and `token` into `nanocoder.serverPort` and `nanocoder.serverToken`.

A couple of smaller things worth knowing.

Smart titles ship in v1.31 and they run in the ACP agent, so they apply to the VS Code extension. A session keeps its opening prompt as the title by default, and when that prompt is too thin to be useful the agent generates a descriptive name once, after the first turn that ran a tool or the first follow-up message. Manual renames are never overwritten. The same fix-up also closed a defect where the CLI's autosave derived the session title from the latest user message and rewrote it on every save, overwriting titles in the store the extension reads from. That one was causing real confusion for people running both surfaces, because the extension would show a title the CLI had just stomped.

The webview is versioned separately from the CLI. The discovery file now carries a `version` field that is actually checked, so a `v2` file written by a newer CLI is treated as missing by an older extension, which is the direction that matters given the two update independently. Older files, including ones written before the field existed, still load.

A Settings tab lives in the sidebar and reads and writes the same files as the CLI (project-level `agents.config.json` first, then your global config directory), resolved the same way. It covers providers, MCP servers, the always-allow list, default mode, auto-compact, reasoning traces, session autosave, token-usage footers, and web search. API keys are masked; the tab shows only whether a key is set. Anything the tab does not cover lives in `agents.config.json`, which `Nanocoder: Open Configuration` opens.

For anyone who has been running `nanocoder --vscode` in a terminal to get the extension's diffs: you can stop. Open the sidebar, the extension will spawn `nanocoder --acp` itself, and the chat is in your editor. If you want both running at once for some reason, the two do not share session state, so be explicit about which one you are talking to.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.
