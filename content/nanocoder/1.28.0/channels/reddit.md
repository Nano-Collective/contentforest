---
product: nanocoder
version: "1.28.0"
channel: reddit
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-06-27T21:54:33.743Z"
---

We just shipped Nanocoder v1.28.0, and this one felt worth writing up properly. The three big additions are an Agent Client Protocol server, a much slimmer built-in tool surface, and session resume that actually replays the conversation. Underneath those there is a fair amount of plumbing work that small local models in particular should benefit from.

## What changed and why

**Agent Client Protocol.** If you have ever wanted to drive Nanocoder from inside your editor instead of inside a terminal panel, this is the release. Run `nanocoder --acp` and Nanocoder speaks JSON-RPC over stdin/stdout. The editor becomes the UI. Streaming text, tool cards, before/after diffs on `string_replace` and `write_file`, permission prompts, model switching, and `ask_user` options all render in the editor instead of the Ink terminal UI. The four development modes (normal, auto-accept, yolo, plan) are exposed as session modes you can flip from inside the editor. Sessions start in auto-accept.

Zed is the reference client for this. The registration is two lines in `settings.json`:

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

Other ACP clients should work too. There are a couple of documented limitations: session history is in-memory across editor restarts (the editor can reload a thread within the same agent run, but after a full restart the thread starts empty), and `ask_user` over ACP is selection-only.

The new module lives at `source/acp/` and covers the agent, server, session, conversation loop, content conversion, capability negotiation, and permission handling. Big thanks to @Avtrkrb for the original implementation.

**Tool surface: 33 down to 19.** The built-in tool count has been a long-standing source of friction, especially for smaller local models that struggle to pick the right tool out of a long list. v1.28.0 consolidates:

- Tasks collapse from four tools into a single `write_tasks` that replaces the whole list (no IDs to track).
- File ops merge `delete`, `move`, `copy`, and `create_directory` into one `file_op`.
- Git shrinks from eleven tools to six: `status`, `diff`, `log`, `add`, `commit`, `pr`. Rarer operations go through `execute_bash`.

Alongside that, the `auto` tune profile is now the default. It infers `full`, `minimal`, or `nano` from the active model's parameter count, so a small local model automatically gets the slim tool set and a shortened prompt, while a cloud model is unchanged. The profile re-resolves live on model switch and is surfaced in the input indicator. `/usage` and the context indicator rebuild from the live tune, mode, and model with the profile-filtered tool count.

About 6.3k lines came out with this work.

**Session resume with full history replay.** This was a quieter request but it bothered people. `/resume` used to bring back a session with an empty chat view, even though the history was on disk. v1.28.0 replays the message and tool-call history into the chat via a new `session-history-renderer`, so you pick up where you left off with the conversation actually visible. An autosave race and a few resume edge cases were fixed alongside it.

## Smaller but useful

- **Schema-validated tool results.** Tool arguments are type-checked against each tool's JSON schema at the execution boundary. A malformed model output returns a clear field-level error the model can self-correct from, instead of being coerced at the render layer. The seam is shared by both native and XML-fallback execution paths.
- **API-reported context usage.** The `ctx: NN%` indicator now uses the final step's `usage` block (provider-accurate) when the model reports it, falling back to a client-side estimate marked with a leading `~`. A tiktoken-based generic fallback tokenizer helps on models without a native tokenizer.
- **Skill linter.** `/skills check <name>` and a `check_skill` tool validate a bundle from disk using the same parsers the loader uses. PASS means it will load. It is wired into `/skills create` so the model verifies and self-corrects what it generates, and it inspects template bodies too (unsupported mustache tags, unbalanced sections, undeclared placeholders), not just frontmatter.
- **Local-model safety.** `string_replace` and `write_file` now require the file to have been read first, and a tool-signature tracker breaks tight tool-call repeat loops.
- **`/copy`.** New slash command that copies the most recent assistant response to the system clipboard, cross-platform via `clipboardy`.
- **Two new providers.** Atlas Cloud is now a first-class provider and a sponsor. Requesty (https://requesty.ai) joins as a first-class OpenAI-compatible provider with the usual wizard template and docs.

There are also a fair number of fixes worth calling out: Copilot GPT-5 reasoning streams stream correctly now, `AbortSignal` propagates to streaming bash so cancelling a turn actually stops a long-running command, corrupted `agents.config.json` is no longer silently clobbered, `read_file` returns a marker instead of throwing on empty files, and compaction no longer splits recent tool-call groups which previously produced empty model output.

## Who this is for

If you have been waiting for an editor-native experience, the ACP server is the headline. If you have been running Nanocoder with a small local model and feeling the weight of a large tool set, the auto profile and the consolidation should make a meaningful difference. If you have lost conversations to the empty-screen resume bug, that is now fixed.

Repo, changelog, and docs are at https://github.com/Nano-Collective/nanocoder. We would love to hear what breaks or what is missing.