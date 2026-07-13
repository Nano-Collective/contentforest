---
product: nanocoder
version: "1.28.0"
channel: linkedin
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 1928
distributed_at: "2026-07-13T13:08:28.585Z"
---

The v1.28.0 release of Nanocoder adds something we have been wanting for a while: an Agent Client Protocol server that lets editors like Zed drive Nanocoder natively, with the editor as the UI rather than a terminal panel.

When you launch `nanocoder --acp`, the agent runs headless and speaks JSON-RPC over stdin/stdout. The editor becomes responsible for everything you used to see in the terminal: streaming text, tool cards with kind and location metadata, before/after diffs for `string_replace` and `write_file`, permission prompts, the four development modes (normal, auto-accept, yolo, plan), model display and switching, and `ask_user` buttons. The Ink terminal UI is simply not loaded.

The new module lives at `source/acp/`. It splits into the parts that have to be separate to keep the conversation loop renderer-agnostic: the SDK server wiring (`acp-server`), the agent implementation (`acp-agent`), session lifecycle (`acp-session`), the conversation loop and streaming (`acp-conversation`), tool-call mapping with `ToolKind` and diff synthesis (`acp-tool-call`), content block conversion (`acp-content`), permission mapping (`acp-permission`), and `ask_user` option normalisation (`acp-question`). Capability negotiation clamps to our protocol version rather than failing the handshake when an editor asks for newer.

Zed is the reference client. Registration is two lines in `settings.json`:

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

How this differs from the VS Code extension: ACP replaces the UI entirely; the VS Code extension adds diff previews and active-editor context on top of the existing CLI UI, which still owns the conversation.

Repo, ACP module, and docs at https://github.com/Nano-Collective/nanocoder.

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.