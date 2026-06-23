---
product: nanocoder
version: "1.28.0"
channel: github-discussion
title: "Nanocoder v1.28.0 - ACP for Zed, slimmer tool surface, session resume"
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.28.0 is out. Headline additions: an Agent Client Protocol server so editors like Zed can drive Nanocoder natively, a consolidation of the built-in tool surface from 33 tools down to 19 with automatic profile selection, and session resume that replays the full message and tool-call history into the chat view. Underneath: structured tool-result validation, API-reported context usage, a skill linter, two new first-class providers, and a long list of fixes for local-model workflows.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Full changelog lives in the repo at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Agent Client Protocol (ACP) for Zed and other editors

Nanocoder can now run as an [Agent Client Protocol](https://agentclientprotocol.com) agent:

```bash
nanocoder --acp
```

When launched with `--acp`, Nanocoder speaks JSON-RPC over stdin/stdout and the editor becomes the UI. Streaming text, tool cards, before/after diffs for `string_replace` and `write_file`, permission prompts, model switching, and `ask_user` options all render in the editor instead of the terminal. The four development modes (`normal`, `auto-accept`, `yolo`, `plan`) are exposed as session modes selectable from the editor; sessions start in `auto-accept`.

The new module lives at `source/acp/` and covers the agent, server, session, conversation loop, content conversion, capability negotiation, and permission handling. Thanks to @Avtrkrb. Closes #529.

Follow-up work added the missing ACP docs, kept the parallel tool-execution loop in sync with the plain shell, and made `NANOCODER_MAX_TURNS` configurable (with a raised default) so long ACP and plain-mode runs are not cut short mid-task.

Setup in Zed is two lines in `settings.json`:

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

Full setup notes and limitations (in-memory session history across editor restarts, selection-only `ask_user`, no image or audio processing) are in the ACP docs at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Tool surface consolidated: 33 down to 19

The built-in tool surface has been consolidated from 33 tools down to 19, with a new auto-detected tune profile as the default. The headline shape changes:

- **Tasks** collapse from four tools into a single `write_tasks` that replaces the whole list. No IDs for the model to juggle, just a current state.
- **File ops** merge `delete`, `move`, `copy`, and `create_directory` into one `file_op`.
- **Git** shrinks from eleven tools to six: `status`, `diff`, `log`, `add`, `commit`, `pr`. Rarer operations flow through `execute_bash`.

On top of the consolidation, the **auto** tune profile is now the default. It infers `full`, `minimal`, or `nano` from the active model's parameter count, so a small local model automatically gets the slim tool set and shortened prompt while a cloud model is unchanged. The profile re-resolves live on model switch and is surfaced in the input indicator (e.g. `tune: nano (auto)`). `/usage` and the context indicator rebuild from the live tune, mode, and model with the profile-filtered tool count, so the numbers reflect what is actually loaded.

Roughly 6.3k lines were removed across this work.

## Structured tool results and single-source validation

Tool arguments are now type-checked against each tool's JSON schema at the execution boundary (`schema-validate.ts`). A malformed model output returns a clear, field-level error the model can self-correct from instead of being coerced at the render layer. Validation runs through a single `withValidation` seam shared by both the native and XML-fallback execution paths, ahead of any per-tool validator.

Approval policy is centralised the same way, and the old global mode context is removed. The current development mode (including a mid-run switch via Shift+Tab) is honoured consistently across the main loop and subagents. Subagents no longer capture `normal` once at startup and silently ignore a later switch.

## Session resume with full history replay

Resuming a saved session now replays the message and tool-call history into the chat view via a new `session-history-renderer`, so you pick up exactly where you left off with the conversation visible rather than an empty screen.

Companion fixes resolved an autosave race, a history-truncation edge case, and resume-after-save paths, all with regression coverage. Thanks to @akramcodez. Closes #545.

## `/copy` for the last assistant response

A new `/copy` slash command copies the most recent assistant response to the system clipboard. Cross-platform via `clipboardy` (pbcopy on macOS, xclip on Linux, clip.exe on Windows). Surfaces a clear warning when there is no assistant message and a real error when the clipboard write fails.

## Safer local-model defaults

Two additions aimed squarely at smaller local models running unattended:

- **Read-before-edit guards.** `string_replace` and `write_file` now require the file to have been read first. A blind edit to a never-read file is rejected at the tool boundary.
- **Tool-call loop detection.** A tool-signature tracker detects a model repeating the same tool call in a tight loop and breaks the cycle.

Both make local models materially safer to leave running on their own.

## Skill linter and command template ergonomics

A new skill linter - `/skills check <name>` plus a `check_skill` tool - validates a bundle from disk using the same parsers the loader uses. A PASS means it will load. It is wired into `/skills create` so the model verifies and self-corrects what it generates. The linter inspects member template bodies too (unsupported mustache tags, unbalanced or unclosed sections, placeholders referencing undeclared parameters), not just frontmatter.

Custom-command bodies now support optional arguments with inline defaults (`name=default`) and conditional sections using mustache's section syntax (`# name` for "if name is set" and `^ name` for "if name is empty"). Inverted-section support in custom-tool templates goes through a shared section engine, so the same rules apply across primitives.

## Two new providers

- **Atlas Cloud** is now a first-class provider and sponsor. Wizard onboarding template and a dedicated provider docs page ship with the release. Atlas Cloud is a full-modal inference platform that exposes LLM, image, and video generation APIs through a single endpoint.
- **Requesty** (https://requesty.ai) is added as a first-class OpenAI-compatible provider, mirroring the OpenRouter integration with a name matcher, app-attribution headers, a wizard onboarding template, and docs. Thanks to @Thibaultjaigu. Closes #589.

## API-reported context usage

The `ctx: NN%` indicator now reflects provider-accurate token counts when the model reports them, captured from the final step's `usage` rather than the tool-loop-summed `totalUsage`. When the provider does not report, Nanocoder falls back to a client-side estimate, marked with a leading `~` (e.g. `ctx: ~42%`); API-reported figures render bare.

Follow-up work anchored the API figure across turns, counted real tool definitions in the auto-compact gate, and added a tiktoken-based generic fallback tokenizer for more accurate counts on models without a native tokenizer. Thanks to @JimStenstrom. Refs #381.

## Smaller things worth knowing

- **Git branch display** in the boot summary and `/status` panel, with narrower-terminal-friendly rendering. Thanks to @ragini-pandey. Closes #539.
- **Provider model discovery** in the wizard now surfaces real discovery errors instead of silently falling back, and shows model names with long labels truncated by ellipsis. Thanks to @akramcodez and @Dhirenderchoudhary. Closes #554.
- **Slash-command completion** supports arrow-key navigation and highlighting, with the double-submit-on-select bug fixed (`TextInput` ignores Enter; `UserInput` handles select-then-submit behind a guard flag) and `customCompletion` restored. Thanks to @rakshith1928. Closes #578.
- **Force-compact-and-retry fallback.** When the LLM server rejects a request for exceeding its context window, Nanocoder now compacts and nudges the conversation to continue instead of failing outright. Thanks to @lordoski. Closes #546.
- **Bash executor** supports timeout, output limits, and abort, with regression tests covering the executor lifecycle. Thanks to @akramcodez. Closes #547.
- **`ask_user` rendering** dropped the leading `?`, fixed spacing and the hanging indent, added arrow-key navigation, and normalised object-shaped options to readable strings (preferring a label over a value id).
- **`@`-file-mention handling** keeps mention placeholders in the chat instead of expanding inline, and large-file inlining is capped to avoid blowing up the prompt.
- **Custom display:** failed tool results condense to a one-liner in compact mode (e.g. `write_file failed.`), while the model still receives the full error in history.

## Fixes

- **Copilot GPT-5 reasoning streams** are now handled correctly via an `@ai-sdk/openai` patch and chat-handler changes, so reasoning content streams properly instead of breaking the response. Thanks to @EntropyParadigm. Closes #577.
- **Propagate `AbortSignal`** to streaming bash execution, so cancelling a turn actually stops a long-running streamed command. Thanks to @Dhirenderchoudhary. Closes #550.
- **Corrupted `agents.config.json` is no longer silently overwritten.** The wizard now honours the `projectDir` prop for config-path resolution and the infinite render loop on the `existingProviders` default param is resolved, all with regression coverage. Thanks to @Dhirenderchoudhary. Closes #551, #552.
- **`read_file` returns an empty marker** instead of throwing on empty files, including range and metadata-only reads. The marker constant is extracted (originally `EMPTY_FILE_MARKER`, later renamed `EMPTY_CONTENT_MARKER`) with tests for files containing only a newline. Thanks to @ragini-pandey. Closes #530.
- **Compaction no longer splits recent tool-call groups**, which previously produced empty model output after compaction.
- **`/` key no longer scrolls the chat view to the bottom** during input. Thanks to @itsishant. Closes #590.
- **Chokidar watcher is closed if daemon startup throws**, and the daemon stop-handler is set up before resources start so a failed lockfile write calls `stop()` and cleans up. Thanks to @OMEE-Y and @rakshith1928. Closes #553, #557.
- A stray `console.log` in `message-queue.tsx` was replaced with the structured logger. Thanks to @A-S-Manoj. Closes #588.
- Subagent context window overrides so delegated agents can run with a different context limit than the main session, and provider names resolve case-insensitively with custom CA bundle support for provider TLS. Thanks to @zerone0x.
- A `tmp >=0.2.6` override resolves a path-traversal advisory in a transitive dependency. Thanks to @ragini-pandey.

## Refactor and dead-code sweep

Beyond the tool-surface consolidation above: unified tool-call ID generation, extracted a shared `useWizardForm` hook, consolidated session-override managers, added message-factory helpers, deduped config loaders, git exec, command dispatch, and conversation-loop flush, extracted `StyledSelectInput` and `makeSimpleToolFormatter`, and deleted several dead modules and orphaned exports (including `fetch-local-models`, orphaned by an earlier removal).

The **Nanocoder Battlemap** competitive comparison and the README and docs have been refreshed.

## Dependency updates

- `ai` 6.0.174 to 6.0.193, plus `@ai-sdk/openai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`
- `@agentclientprotocol/sdk` 0.22.1 to 0.25.0
- `undici`, `esbuild`
- `@biomejs/biome` 2.5.0
- `lint-staged` 17
- `@types/node`, `@types/vscode`, and other transitive bumps tracked through the lockfile
- `clipboardy ^5.3.1` for `/copy`

If anything is broken or surprising, please open an issue or drop a note in Discord. Thank you for using Nanocoder.