---
product: nanocoder
version: "1.28.0"
channel: linkedin
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-06-27T21:24:00.563Z"
---

Nanocoder v1.28.0 is out. The release lands three big things and a long tail of fixes.

The headline addition is Agent Client Protocol support. Run `nanocoder --acp` and the editor becomes the UI. Streaming text, tool cards, before/after diffs, permission prompts, and model switching all render in the editor instead of the terminal. The four development modes are exposed as session modes, so you can switch between normal, auto-accept, yolo, and plan from inside the editor. Sessions start in auto-accept. The first editor to drive this end to end is Zed; the registration is two lines in `settings.json`.

The second is a tool-surface consolidation. The built-in tool count drops from 33 to 19. Tasks collapse to a single `write_tasks` that replaces the whole list (no IDs for the model to juggle). File ops merge delete, move, copy, and create_directory into one `file_op`. Git shrinks from eleven tools to six. Alongside that, the `auto` tune profile is now the default. It infers `full`, `minimal`, or `nano` from the active model's parameter count, re-resolves live on model switch, and is surfaced in the input indicator. Small local models get the slim tool set and a shorter prompt automatically. Roughly 6.3k lines went out with this work.

The third is session resume with full history replay. Resuming a saved session now replays the message and tool-call history into the chat view via a new session-history-renderer, so you pick up where you left off with the conversation visible rather than an empty screen. An autosave race and a few resume edge cases were fixed at the same time.

Underneath that: tool arguments are now type-checked against each tool's JSON schema at the execution boundary, so a malformed model output returns a clear field-level error the model can self-correct from. The `ctx: NN%` indicator now uses API-reported token counts when the model provides them, falling back to a client-side estimate marked with a leading `~`. A new skill linter validates bundles from disk the same way the loader does, and is wired into `/skills create` so the model verifies and self-corrects what it generates. Two new first-class providers, Atlas Cloud and Requesty, join the wizard.

Local models got safer defaults too: read-before-edit guards on `string_replace` and `write_file`, and a tool-call loop detector that breaks tight repeat loops. A new `/copy` slash command copies the last assistant response to the clipboard cross-platform.

Full release notes and changelog at https://github.com/Nano-Collective/nanocoder.

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.