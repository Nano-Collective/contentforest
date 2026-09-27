---
product: nanocoder
version: "1.31.0"
channel: linkedin
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 2942
---

The Nanocoder VS Code extension used to be a WebSocket mirror of a terminal session. v1.31 rebuilds it as a native sidebar chat that runs the agent itself.

The extension now spawns and supervises `nanocoder --acp` over the Agent Client Protocol, so the chat, the streaming, the approvals, the file-edit cards, the task checklists, the model picker, and the slash-command autocomplete all live in the editor. The CLI is no longer a peer of the editor; it is a child process whose lifetime the editor owns.

Each turn's thoughts, tool calls, edit cards, and task plan are collected into one ordered, collapsible work summary, with the reply text kept outside it so the answer is never hidden. The summary reports how long the turn took ("Worked for", "Stopped after" or "Failed after" plus the duration) and reopens automatically when a tool inside it needs your approval.

A few things that fall out of the new shape:

- File-change chips above the composer. Each file the agent finishes writing appears as a chip; click one to open the file as it stands now, the `x` dismisses it. Deleting a file takes its chip away, renaming one moves its chip to the new path. Only completed calls count, so a denied delete leaves the row as it was.
- Code lenses on every function, method, constructor, and class in an open editor. `Explain Code` and `Generate Tests` open the chat and send a prompt with that symbol's source inlined. Off with `nanocoder.codeLens`.
- Live subagent progress. When the AI delegates, the subagent's tool card updates live with name, token usage, tool count, and the last tool it used.
- Cancellation in the chat. The send button becomes a stop button while a turn runs; Escape cancels the current tool and skips queued ones.
- Approval prompts now answer exactly once, so a second answer from a settled prompt cannot consume the next queued request unseen.
- Retry and copy per response. Retry removes the response from the chat and truncates the conversation back to that prompt, so the model does not see the discarded answer.

The legacy WebSocket companion is still there for people who prefer the TUI. It is now opt-in via `nanocoder.autoConnect`, and the security shape is fixed: the companion server used to bind a fixed loopback port and accept every upgrade, so any local process could deliver a prompt straight into a running agent. The server now mints a 256-bit bearer token per session, writes it to a discovery file (`vscode-server.json` in your Nanocoder config directory), and rejects unauthenticated cross-origin requests.

Smart titles ship in v1.31 and they run in the ACP agent, so they apply to the VS Code extension. A session keeps its opening prompt as the title by default; when that prompt is too thin, the agent generates a descriptive name once, after the first turn that ran a tool. Manual renames are never overwritten.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.
