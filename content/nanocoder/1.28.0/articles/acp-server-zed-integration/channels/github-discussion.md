---
product: nanocoder
version: "1.28.0"
channel: github-discussion
title: "Nanocoder as an ACP agent: driving it from Zed"
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 16988
distributed_at: "2026-07-13T12:37:04.083Z"
---

The headline of v1.28.0 lists "ACP for Zed" alongside a tool-surface consolidation and a session-resume fix. The first item deserves its own write-up, because what actually shipped is a different agent: same Nanocoder, same tool definitions, same provider plumbing, but a headless core speaking JSON-RPC instead of an Ink terminal UI. This post walks through what changes when the editor becomes the UI, what gets rendered there, how the protocol mapping works, and how ACP differs from the WebSocket-based VS Code integration that has been around since the extension shipped.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## The shortest possible description

There is a new flag:

```bash
nanocoder --acp
```

When launched with `--acp`, Nanocoder does not draw anything. It reads JSON-RPC from stdin and writes JSON-RPC to stdout. The editor spawns the process, owns the lifecycle, and renders everything - conversation text, tool cards, permission prompts, `ask_user` options, session modes, model selectors - using its own UI. The Ink terminal UI is replaced wholesale by the editor's agent panel.

That is the whole shape. The interesting part is what got built to make it work.

## The module: `source/acp/`

The ACP support lives in a new top-level module rather than being threaded through the existing UI code, which keeps the conversation loop and the Ink renderer independent of the JSON-RPC layer. As of v1.28.0 the module contains:

- `acp-server.ts` - the `@agentclientprotocol/sdk` server wiring, lifecycle, and stdio transport.
- `acp-agent.ts` - the top-level `Agent` implementation that the SDK calls back into.
- `acp-session.ts` - session lifecycle: creation, restoration, the in-memory history map keyed by `sessionId`.
- `acp-conversation.ts` - the conversation loop, streaming, tool-call emission, and the `FINAL_TURN_INSTRUCTION` that nudges the model to wrap up rather than loop.
- `acp-tool-call.ts` - maps internal tool definitions to the ACP `ToolCall` / `ToolCallUpdate` shape, including the `ToolKind` mapping, follow-along `location` data, and the before/after diff for edits.
- `acp-content.ts` - converts Nanocoder message blocks (markdown, resource links, embedded resources, fenced code) to and from the ACP content block types.
- `acp-permission.ts` - maps tool approval requirements to ACP permission options, respecting the current development mode.
- `acp-question.ts` - normalises `ask_user` option shapes (string vs `{label, value}` objects) into strings the editor can render as buttons.
- `acp-capabilities.ts` - what we tell the client we support: `loadSession`, `sessionCapabilities.close`, plus the fixed list of session mode ids and protocol-version negotiation.
- `acp-types.ts` - module-local type aliases.

Specs sit next to each file (`*.spec.ts`). The total module is around 3.4k lines including tests.

## JSON-RPC replaces the terminal

In the Ink CLI, conversation state is held inside the React/Ink renderer: a `MessageList` keeps the visible history, a `UserInput` owns the input box, a `ToolExecutionCard` renders each in-flight tool call, and the mode/ctx/tune indicators live on a status line. None of that runs over ACP. The renderer is simply not loaded.

What does run is the same conversation loop the CLI uses, but it emits to an `AcpAgent` adapter instead of to Ink. The adapter translates three things:

1. **Streaming text chunks** into ACP `session/update` notifications with `agentMessageChunk` content blocks.
2. **Tool calls** into `toolCall` notifications carrying a `kind` (read, edit, delete, move, search, execute, think, fetch, etc.), the touched file paths as `locations`, and for edits a `diff` payload with `oldText` and `newText`.
3. **Approvals and questions** into `requestPermission` / `ask_user` calls that block on the editor's response.

The benefit is concrete: the editor gets to render the agent inside its own UI primitives. Zed, for example, draws the streaming text inside its agent panel, attaches a `diff` viewer to each edit tool call, and pops its own allow/deny dialog for permission requests. The Ink equivalent of "a tool card with a diff viewer inside it" is something we would have to design and maintain ourselves; ACP gets it for free as long as the tool call carries a `diff` block.

## What gets rendered in the editor

The current list of affordances that work over ACP, taken from the ACP feature doc and the source:

- **Streaming responses**, including reasoning / thinking content, drawn inline in the agent panel.
- **Tool calls as rich cards.** File tools report their `kind` (e.g. `edit`, `read`, `execute`) and the file paths they touch as `locations`, so the editor can render a "follow-along" cursor alongside the conversation. `string_replace` and `write_file` additionally attach a `diff` block (`oldText`, `newText`) so the editor can show a before/after view in the card itself.
- **Permission prompts**, surfaced as the editor's own allow/deny dialog. The decision is fed back into the same approval pipeline the CLI uses; nothing in the conversation loop has to know it is being driven by ACP rather than Ink.
- **Development modes** - `normal`, `auto-accept`, `yolo`, `plan` - exposed as ACP session modes. Selecting one in the editor is equivalent to pressing Shift+Tab in the CLI. Sessions start in `auto-accept` by default.
- **Model display and switching.** The editor shows the current model and lets you switch between the models configured for your active provider. Pinning a model per editor session is also possible via `args` in `settings.json` (see below).
- **`ask_user`.** When the agent asks a clarifying question, the options appear as selectable buttons in the editor. The model receives whichever option the user picks. Selection only - there is no free-form typed answer over ACP, which is a protocol-level constraint.
- **`@`-mentioned files.** Files referenced through the editor's file-mention UI are sent as resource links and included in the prompt. The editor's live buffer is used when available, so unsaved edits are picked up.
- **Session reload.** Reopening a thread is supported, so the editor does not error when restoring a session on startup.

## What does not work over ACP (yet)

The feature doc lists three honest limitations:

- **Session history is in-memory.** Within a single running agent process, reopening a thread restores its history. After the editor and the agent process fully restart, a reloaded thread starts empty. It is usable, but prior messages are not replayed. This is a deliberate scope cut: the CLI's session-resume work in v1.28.0 replays into the Ink chat view via a `session-history-renderer`, but ACP does not yet replay through the protocol. The internal `acp-session.ts` keeps a `Map<sessionId, history>`, which is the seam where replay would attach.
- **`ask_user` is selection-only.** ACP permission options have no text input. The model receives the picked option rather than a typed answer. For most clarifying questions this is fine; for anything that needs free-form prose the workaround is to phrase the question so the options cover the meaningful choices.
- **Images and audio are not processed.** Non-text attachments are noted to the model but not interpreted. This is true of the CLI too right now; the ACP layer does not paper over it.

There is also a fourth, unspoken one worth knowing about: the editor spawns the agent in its current working directory, so project-level config (`agents.config.json`) and relative paths resolve against the open folder. That is usually what you want. If you open a folder without a configured provider, the agent exits with "No provider configured" and the editor surfaces the error.

## Tool kinds and follow-along locations

The `ToolKind` mapping in `acp-tool-call.ts` is worth a quick look, because it is what lets the editor draw the right kind of tool card:

```ts
const TOOL_KINDS: Record<string, ToolKind> = {
  read_file: 'read',
  write_file: 'edit',
  string_replace: 'edit',
  delete_file: 'delete',
  file_op: 'move',
  find_files: 'search',
  search_file_contents: 'search',
  list_directory: 'read',
  execute_bash: 'execute',
  ...
};
```

For file tools, the converter also extracts `locations` so the editor can render a "follow-along" line: open `src/auth/session.ts`, then `src/auth/session.ts:42`, then back. That is the same data the Ink CLI uses to draw path hints, just delivered in a structured field the editor can act on.

The diff builder is the more interesting bit. For `string_replace`, the converter reads the file off disk, applies the proposed `old_str` / `new_str` in memory, and emits:

```ts
{type: 'diff', path: absPath, oldText, newText}
```

For `write_file` it diffs the existing contents (if any) against the new contents. The editor then renders the diff in the tool card and lets the user step through it before the tool executes - which is to say, permission is reviewed with the proposed change already visible, not after.

A subtle detail: the diff builder only synthesises a whole-file diff for `string_replace` when the replacement is unambiguous. If the same `old_str` matches multiple regions, it skips the synthetic diff rather than guessing. The model gets a normal approval request and the editor gets the raw before/after from the tool args; this avoids the worst failure mode where a "diff" disagrees with what the code actually does.

## Session modes

`acp-capabilities.ts` exposes the four development modes as ACP session modes:

```ts
const ACP_MODES: SessionModeId[] = ['normal', 'auto-accept', 'yolo', 'plan'];
const MODE_MAP: Record<SessionModeId, DevelopmentMode> = {
  normal: 'normal',
  'auto-accept': 'auto-accept',
  yolo: 'yolo',
  plan: 'plan',
};
```

The mapping is identity today, which is the point. The ACP session mode is just a label the editor flips; the approval pipeline that interprets it is the same one Shift+Tab flips in the CLI. A mid-session change in the editor updates the in-memory development mode and the next approval request goes through the new policy - no special case for ACP.

`plan` is the most useful one to know about here, because the editor integration is where it really starts to earn its keep: switch to plan mode, ask the model to investigate a refactor, get a structured plan back, switch to `normal` and ask it to execute, all without leaving the editor. Conversation history carries across the switch because it is just a mode flip on the existing session.

## Capability negotiation

A short but important detail in `acp-capabilities.ts`:

```ts
export function negotiateProtocolVersion(clientRequested: ProtocolVersion): ProtocolVersion {
  // Clamp the client's requested version down to ours. Never claim support
  // for a newer protocol than this SDK implements.
}
```

The SDK exposes the protocol version; we declare a fixed one. If the editor asks for a newer protocol than we implement, we respond with ours rather than failing the handshake. This avoids the failure mode where a forward-compatible editor feature silently breaks because of a minor version mismatch. `loadSession: true` is the other capability we advertise, alongside `sessionCapabilities.close` - that is, we can reload a session by id, and we support the close handshake.

## Setup in Zed

Zed is the reference ACP client for this release. Two lines in `settings.json` (Cmd+, on macOS, or `zed: open settings` from the command palette):

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

To pin a specific provider or model for the editor session:

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

Otherwise Nanocoder resolves the provider and model the same way the CLI does - from the project's `agents.config.json`, falling back to the global config. The agent is spawned in the editor's current working directory, so project-level config and relative paths resolve against the open folder.

One practical snag worth knowing about: if Zed was launched from the desktop rather than a terminal, it may not see your shell's `PATH`. The fix is to point `command` at an absolute path to the binary (or to the Node runtime plus the script), or to launch Zed from a shell so it inherits `PATH`. This is not an ACP issue; it is just how macOS app launches work.

## ACP vs. the VS Code extension

Both connect Nanocoder to an editor, and both predate v1.28.0 in some form, but they are different mechanisms. The shape of the difference matters for picking which one to use:

| | Transport | Flag | Editor role |
| --- | --- | --- | --- |
| ACP | JSON-RPC over stdin/stdout | `--acp` | Editor is the UI |
| VS Code extension | WebSocket on port 51820 | `--vscode` | Editor adds previews on top of the CLI UI |

With ACP, the **editor is the UI.** The agent runs headless, and the editor renders the conversation, tool cards, diffs, and approval prompts using its own primitives. The Ink terminal UI is not loaded. The agent does not have its own window to draw in.

With the VS Code extension, the **CLI UI stays in charge.** You still run `nanocoder --vscode` in a terminal; the extension connects over a local WebSocket on port 51820 and adds two things on top: live diff previews for proposed file changes, and active-editor context (the focused file and any selection, pushed to the CLI continuously and rendered as a `⊡ In App.tsx` pill on the input status line).

That difference shows up in three places that matter in practice:

1. **Where you launch the agent.** With ACP, the editor spawns it. With VS Code, you launch it from a terminal or from VS Code's command palette (`Nanocoder: Start Nanocoder CLI`), and the extension connects to the running process.
2. **Where conversation history lives.** With ACP, the agent is bound to the editor's session lifecycle. With VS Code, it lives in the CLI process; the extension is purely additive.
3. **What "the UI" is.** With ACP, the editor's agent panel is the only UI. With VS Code, the terminal UI is the UI; the extension adds diff previews and editor context, but the conversation text, mode indicator, and input box are still the Ink CLI's.

Practically: if your editor supports ACP, that is the cleaner integration today, because the conversation loop is rendering in one place and the editor owns it. The VS Code extension remains the right choice for editors that do not yet speak ACP, and it picks up one nice feature from the v1.28.0 tool consolidation: the `⊡ In <file>` status-line pill now points at the slimmed-down file tools and reads more cleanly because there are fewer of them.

## What is still rough

A few things worth being honest about:

- **Session resume over ACP is not implemented.** The CLI replay landed in v1.28.0 via `session-history-renderer`; the ACP path has the data in `acp-session.ts` but does not push it back through the protocol on `loadSession`. Reopening a thread within a single running agent works; reopening across an editor restart starts empty.
- **`ask_user` has no text input.** Selection only. For most clarifying questions this is fine; for any question that genuinely needs prose it is a constraint.
- **No image / audio attachments.** The model is told they were mentioned but cannot see them. The CLI is the same way.
- **Long edits can produce large diffs.** The diff is sent inline in the tool-call notification; very large files mean very large protocol messages. There is no streaming diff yet.
- **ACP protocol version is fixed.** We clamp to our version rather than negotiating upward. A forward-compatible editor will work; a feature-gated one that requires a newer version than we expose will silently fall back to the subset we support.

None of these block day-to-day use. They are the places where the integration gets noticeably less polished if you happen to hit them.

## Why this matters

The headline framing of v1.28.0 is "ACP for Zed." The more interesting framing is that Nanocoder now has a second front-end. The conversation loop, tool definitions, provider plumbing, session management, and development modes are all unchanged - the ACP adapter is one more consumer of the same internal APIs the Ink CLI uses. Adding another editor that speaks ACP (there are several in flight upstream of the protocol) is now a matter of writing the JSON-RPC transport, not porting the UI. That is the structural payoff, and it is the reason the module is structured as it is.

If you try it and something is broken or surprising, please open an issue. The [Nanocoder repo](https://github.com/Nano-Collective/nanocoder) is the right place, and the ACP-specific docs under `docs/features/acp.md` track the current state of what is and is not supported.