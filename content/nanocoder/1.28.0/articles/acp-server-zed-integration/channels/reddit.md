---
product: nanocoder
version: "1.28.0"
channel: reddit
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 5794
distributed_at: "2026-07-13T13:21:48.497Z"
---

A walkthrough post on the Agent Client Protocol server we shipped in Nanocoder v1.28.0, what the integration actually does inside the editor, and how it differs from the WebSocket-based VS Code extension.

## What `--acp` actually does

There is a new flag:

```bash
nanocoder --acp
```

When launched with that flag, Nanocoder does not draw anything. The Ink terminal UI is not loaded. The agent reads JSON-RPC from stdin and writes JSON-RPC to stdout. The editor spawns the process, owns the lifecycle, and renders everything using its own UI primitives.

The mapping is structured. Streaming text becomes `session/update` notifications with `agentMessageChunk` content blocks. Tool calls become `toolCall` notifications carrying a `ToolKind` (read, edit, delete, move, search, execute, etc.), the touched file paths as `locations`, and for `string_replace` and `write_file` a `diff` payload with `oldText` / `newText` that the editor can render in the tool card. Permission requests become `requestPermission` calls that block on the editor's allow/deny dialog and feed back into the same approval pipeline the CLI uses.

The four development modes - `normal`, `auto-accept`, `yolo`, `plan` - are exposed as ACP session modes. Sessions start in `auto-accept`. `plan` is where this really earns its keep: ask the model to investigate a refactor in plan mode, get a structured plan back, switch to `normal` and ask it to execute, all without leaving the editor. Conversation history carries across the switch because it is just a mode flip on the existing session.

## The module structure

The ACP support lives at `source/acp/` as a self-contained module rather than being threaded through the Ink renderer. The split:

- `acp-server.ts` - the `@agentclientprotocol/sdk` server wiring and stdio transport.
- `acp-agent.ts` - the `Agent` implementation the SDK calls back into.
- `acp-session.ts` - session lifecycle and the in-memory `Map<sessionId, history>`.
- `acp-conversation.ts` - the conversation loop, streaming, tool-call emission.
- `acp-tool-call.ts` - tool name to `ToolKind`, location extraction, and the diff synthesis for edits.
- `acp-content.ts` - message block conversion (markdown, resource links, embedded resources, fenced code).
- `acp-permission.ts` - maps tool approval requirements to ACP permission options.
- `acp-question.ts` - normalises `ask_user` options (string vs `{label, value}` objects) into renderable strings.
- `acp-capabilities.ts` - `loadSession: true`, `sessionCapabilities.close`, the fixed session mode list, and protocol version negotiation that clamps to our version.

The whole module is around 3.4k lines including tests. The conversation loop and tool definitions are unchanged from the CLI; the ACP adapter is one more consumer of the same internal APIs.

## What is rough

Three honest limitations:

- **Session history is in-memory across an editor restart.** Within a single running agent process, reopening a thread restores its history. After the editor and the agent process fully restart, a reloaded thread starts empty. The CLI's session resume in v1.28.0 uses a `session-history-renderer` to replay into Ink; ACP does not yet replay through the protocol on `loadSession`.
- **`ask_user` is selection-only.** ACP permission options have no text input. The model gets the picked option rather than a typed answer.
- **No image / audio attachments.** Non-text mentions are noted but not interpreted. The CLI is the same way.

## ACP vs. the VS Code extension

Both connect Nanocoder to an editor. They are different mechanisms:

| | Transport | Flag | Editor role |
| --- | --- | --- | --- |
| ACP | JSON-RPC over stdin/stdout | `--acp` | Editor is the UI |
| VS Code extension | WebSocket on port 51820 | `--vscode` | Editor adds previews on top of the CLI UI |

With ACP the **editor is the UI.** The agent runs headless and the editor renders conversation, tool cards, diffs, and approvals using its own primitives.

With the VS Code extension the **CLI UI stays in charge.** You still run `nanocoder --vscode` in a terminal; the extension connects over a local WebSocket and adds two things on top: live diff previews for proposed file changes, and active-editor context (focused file and selection, pushed to the CLI continuously and rendered as a `⊡ In App.tsx` pill).

Three places that difference shows up:

1. **Where you launch the agent.** ACP: the editor spawns it. VS Code: you launch it from a terminal or from VS Code's command palette, and the extension connects.
2. **Where history lives.** ACP: bound to the editor's session lifecycle. VS Code: in the CLI process; the extension is purely additive.
3. **What "the UI" is.** ACP: the editor's agent panel. VS Code: the terminal UI, with the extension adding diff previews and editor context on top.

If your editor supports ACP, that is the cleaner integration today. The VS Code extension remains the right choice for editors that do not yet speak ACP.

## Setup in Zed

Two lines in `settings.json`:

```json
{
  "agent_servers": {
    "Nanocoder": {
      "command": "nanocoder",
      "args": ["--acp"]
    }
  }
}
```

Pinning a provider and model is also possible via `args`:

```json
{
  "agent_servers": {
    "Nanocoder": {
      "command": "nanocoder",
      "args": ["--acp", "--provider", "ollama", "--model", "qwen2.5-coder:7b"]
    }
  }
}
```

One practical snag: if Zed was launched from the desktop rather than a terminal, it may not see your shell's `PATH`. Use an absolute path in `command`, or launch Zed from a shell. Standard macOS app launch behaviour, not an ACP thing.

Full setup notes and limitations in the ACP docs at https://github.com/Nano-Collective/nanocoder. If you try it and something is broken or surprising, please open an issue.