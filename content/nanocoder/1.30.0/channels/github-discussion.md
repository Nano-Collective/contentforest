---
product: nanocoder
version: "1.30.0"
channel: github-discussion
title: "Nanocoder v1.30.0: /settings, /commit, usage footer, VS Code chips"
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 19104
distributed_at: "2026-08-27T10:16:03.768Z"
---

Nanocoder v1.30.0 is out. The shape of this release is consolidation. The biggest change is that almost every remaining CLI setting now lives inside `/settings`, so you can configure Nanocoder without editing `.json` files by hand. Alongside that: a new `/commit` slash command generates Conventional Commit messages from your staged diff using the active LLM, every assistant response now shows provider-reported token usage and an estimated cost, the VS Code extension gained context attachment with file chips and `@` mention autocomplete, and the long list of fixes is mostly about tool results staying inside the context window instead of eating it.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Full changelog and docs at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Everything lives in `/settings` now

The remaining CLI configuration has been folded into the `/settings` menu. Settings are grouped into Appearance, Input, Behavior, Providers, MCP, and Advanced tabs. New menu items let you set the default mode, auto-compact, sessions, reasoning traces, tool auto-approval, and a Web Search API key; view your configured providers and MCP servers before opening the setup wizards; open the Tune Model and Connect IDE wizards; and see the active `NANOCODER_*` environment variables. Advanced also includes an in-app JSON editor for `agents.config.json`: edit strings with the cursor inside the quotes, flip booleans with the arrow keys, and save atomically (a crash can't leave a half-written file).

`/setup-providers` and `/setup-mcp` are sunset. Both retired names still work for now, they open the matching `/settings` tab with a notice instead of erroring. `/settings` now takes a tab argument (`/settings providers`, `/settings mcp`), MCP has its own settings tab, and provider edits made from settings apply to the running session instead of waiting for the next launch. Selecting a provider or MCP server in settings opens that entry's edit or delete choice directly, with a separate row for adding a new one.

A handful of wizard fixes rode in with this:

- **Adding a provider lands on the wizard's root menu**, which offers "Done & Save" up front instead of dropping you back into the raw provider template list.
- **Mode-specific providers are now opt-in.** "Configure mode-specific providers" is its own entry in the provider menu that returns you to the provider menu when you're finished, and **Done & Save** goes straight to the summary. Mode providers already in the config are carried through a save that skips the step.
- **The list selectors now route through `StyledSelectInput` and highlight with the theme's `primary` colour** instead of the dark `blue` from `ink-select-input`, which ignored the active theme and was hard to read on dark terminals. Five themes (cherry-blossom, ayu-light, everforest-light, volcanic-ash, solarized-light) were also raised to WCAG AA contrast.

## `/commit`

A new `/commit` slash command generates Conventional Commit messages from your staged Git diffs using the active LLM client. `/commit --copy` (short form `-c`) copies the generated message to the system clipboard; if the clipboard is unavailable the message is still shown with a note, rather than being lost. An unrecognised option now reports a usage line instead of being silently ignored. `/commit` also shows a spinner while the model generates the message, so the round-trip is no longer a silent pause (commands opt into this by declaring `progressLabel`). Closes #757. Thanks to @DeepamJha.

## Per-response usage and cost footer

Every assistant message in the CLI now ends with a subtle gray footer showing the provider-reported token count and an estimated cost (for example `Tokens: 4.2k | ~$0.01`), computed from models.dev pricing. The cost segment is omitted for local and free models, and the footer falls back to the previous client-side estimate when the provider reports no usage. The VS Code extension shows the same indicator under each finished response, fed by the per-turn usage now returned on the ACP prompt response.

The estimate prices all input tokens at the standard rate. Cache read and write discounts are not factored in, so costs can be overstated for providers with prompt caching.

The footer is optional. Turn it off under `/settings`, Behavior, Tool Results and Thinking, **Usage & Cost Footer**, or by setting `showUsageFooter` to `false` in the preferences file. Turning it off removes the footer line entirely (both the provider-reported tokens and cost and the client-side token estimate) and applies to replayed session history and subagent transcripts as well as live responses. The preference is read per message, so toggling it takes effect from the next response without a restart, and the models.dev pricing lookup is skipped altogether when the footer is off. Closes #756.

## VS Code extension: context, attachments, and code lenses

The VS Code extension gained the most user-visible features this cycle.

**Context attachment.** File and folder chips with drag-and-drop support, plus a consolidated `+` menu for uploads so the UI has room to grow as new attachment types land. Image uploads and pasting are supported in the chat panel, so multimodal messages (text plus images) are first-class.

**`@` mention autocomplete.** Typing `@` in the chat composer opens a floating dropdown of workspace files, folders, and open editors, and selecting one attaches it as a context chip. Search runs on the extension host, which merges your `files.exclude` and `search.exclude` settings into the exclude list so hidden files stay out of the dropdown. A bare `@` lists open editor tabs with no disk I/O. Attached files are now read with a 100 KB cap and binaries are skipped, so a mis-picked lockfile can no longer swallow the context window. Closes #747.

**Code lenses.** Every function, method, constructor, and class now carries `Explain Code` and `Generate Tests` links. Clicking one reveals the chat view and sends that symbol instruction, `file:startLine-endLine`, and the source (fenced with the document language) as a prompt. Symbols come from the language server, so no per-language parsing is involved, and the lenses can be turned off with `nanocoder.codeLens`. Long symbols are capped before being inlined, so a lens click on a large class cannot spend a whole context window on one turn. Also fixes a pre-existing hang where sending a message while a tool approval was still pending left the composer spinning forever. Closes #750.

**Copy-to-clipboard and `/copy code`.** Hovering over a user prompt or agent response bubble reveals a clipboard icon that copies the raw markdown text and briefly shows a checkmark to confirm. Streamed agent responses always copy the latest in-progress text. `/copy code` (and a Ctrl+Alt+Shift+C / Cmd+Alt+Shift+C keybinding) copies the last code block from the previous assistant response. `/copy` and `/copy code` now address the whole last assistant response rather than its final text fragment, so a tool call between the code block and the closing prose no longer hides the block. Closes #746.

**Chat panel shows queued work.** Every tool call in a turn is announced before the batch runs, so the checklist reads queued, running, done, with rows in plain English ("Reading source/x.ts", "Running pnpm test") instead of raw tool names. Queued edits read "Edit x.ts" until they actually run, and their Open Diff action only becomes clickable once the diff exists. Cancelling a turn settles every queued row rather than leaving the ones behind the cancelled tool spinning, which also fixes the same stall in other ACP clients such as Zed. The task checklist is now scoped to the turn that produced it instead of one card reused for the whole session.

**Escape cancels in-flight requests.** Pressing Escape in the chat panel instantly cancels an in-flight LLM request, mirroring the Stop button. The listener is on the webview's `document` (not just the chat input) so it fires even when focus has moved to a tool card, button, or streaming area. A `nanocoder.cancel` command is also added to the Command Palette. Cancelling shows a clean "Cancelled by user" note inline in the chat instead of an error toast.

**Cancelling pending approvals.** Cancelling while a tool is waiting for approval no longer wedges the chat. The pending permission resolver was left in place before, so the extension kept reporting an outstanding prompt and rejected every later message with "Please approve or deny the pending tool" until the window was reloaded. Cancelling (or starting a new chat) now answers any outstanding permission requests with a cancelled outcome and dismisses their approval cards. Cancelled tool cards no longer render with the error icon (ACP has no `cancelled` tool status, so the webview had to match the raw output case-insensitively).

**Session management.** Sessions can now be renamed directly from the History view. A `renameSession` ACP extension method (`extMethod`) is implemented on the CLI's ACP agent, so a session's title can be updated in place without a full resume. Creating a new chat or resuming a session from the History list now returns to the active chat view instead of leaving the panel stuck on the session list.

**`/settings` in the GUI.** Typing `/settings` in the VS Code chat no longer claims the command is unsupported. The extension gained a Settings tab, so `/settings` points at it the same way `/model` and `/provider` point at the header dropdowns.

## Tool results stay inside the context window

This cycle did a lot of work to keep tool results from re-entering model context unbounded.

- `execute_bash` and custom tools now truncate long output tail-weighted (head plus tail) instead of head-only, so the actionable part of compiler and test-runner output (error list, failure summary, exit status) isn't discarded.
- Oversized tool results are bounded before they re-enter context while preserving both the beginning and the actionable tail.
- `string_replace` and `diff_edit` results are bounded to a context window around the edited range. Closes #795. Thanks to @RealBhupesh.
- Oversized multi-file `git_diff` results are bounded to a 20-entry diffstat while preserving the total file count; file-scoped results stay as bounded head-and-tail patches.
- `list_directory` no longer includes file sizes by default, they cost an `lstat` per file plus output tokens for information that's rarely needed just to orient in a directory. Pass `showSizes=true` to opt back in, or use `read_file` with `metadata_only=true`.
- `read_file` returns a useful preview before requiring ranged reads for very large files, and the read-before-edit refusal now specifies that files over 300 lines need a ranged read.

## Providers

- **Groq and OrcaRouter** join the setup wizard as first-class provider templates.
- **Atlas Cloud wizard now stores provider-qualified GPT-5.6 model IDs**, while preserving compatibility with existing shorthand configurations. Closes #803. Thanks to @RealBhupesh.

## Streaming and reasoning fixes

- **GitHub Copilot reasoning models no longer crash with `Cannot read properties of undefined (reading 'summaryParts')` when streaming.** Copilot's Responses API proxy rotates the opaque reasoning item id mid-stream while `output_index` stays stable, so the OpenAI Responses parser looked up state that was never registered and the stream died. The Copilot response stream is now normalized before it reaches the parser: a rotated id is mapped back to the reasoning item already tracked at that `output_index`, and a reasoning item that was never announced is announced first. Closes #719.
- **The VS Code extension's thought dropdown now expands to actual content.** Routing now follows the delta type and flushes the pending batch before switching streams, so a batch always leaves on the callback it was filled for. Whitespace-only reasoning no longer emits an ACP thought chunk, is no longer stored on the message, and no longer opens a thought section, so the empty "Thought for 0s" bubbles are gone. Closes #853.
- **Streamed thoughts are grouped into a single expandable section per response** instead of one dropdown per thought block. Thoughts interrupted by answer text or tool calls now resume in the same section, separated by a blank line, and the header reports the total time spent reasoning ("Thought for 12s") rather than one short duration per fragment. The section still auto-expands while thoughts stream and collapses when they stop, but stops doing so once the user toggles it by hand. Closes #854.

## Headless and CLI fixes

- The `--plain --json` `usage` block is omitted unless at least one token count is reported; `totalTokens` falls back to input plus output when the provider omits it, so downstream harnesses can distinguish "no telemetry available" from a genuine zero.
- The mutating-tool list for `filesChanged` matches the registered names in `source/tools/file-ops/`, so runs using `write_file` or `diff_edit` report changed files correctly.
- `fetch_url`'s SSRF guard blocks IPv6 loopback (`[::1]`, its expanded and IPv4-mapped spellings, and the unspecified `[::]` address). Previously it rejected `127.0.0.1` but let `http://[::1]:8080` through. Closes #734.
- Ink and `@/app` are deferred in the CLI entry point until the interactive TUI branch, so `--acp`, `--plain`, and auth paths no longer pay that module-graph cost at startup.
- `!` bash commands no longer keep the whitespace after the prefix (`! git status` runs `git status` instead of ` git status`), and the bounded terminal content width is now 200 columns (up from 120) so wide terminals use more available space.
- User-typed `!` bash commands show their stdout and stderr in the transcript (tail-capped at 20 lines). Previously the card only showed the command and a status dot; the result was never shown. Model-invoked `execute_bash` calls keep their compact display.
- `search_file_contents` formats results grep-style (`file:line:content`), with `contextLines` blocks under a `-` separator matching grep's convention.
- `list_directory`, `read_file` metadata, and `@file`-mention metadata no longer include `toLocaleString()` thousands-separators when returned to the model (extra tokens, no extra meaning). Terminal display components still show them.
- The setup wizard's config location picker shows the resolved path next to each option.
- An MCP server no longer stays visible as connected when its initial `tools/list` call fails. `connectToServer()` registers the client, transport, and config only after tool discovery succeeds.
- Info, success, warning, and error messages render continuation lines correctly (Ink wraps with `trim: false`, so a word-boundary space on the wrap column used to become the first character of the next line; messages are now pre-wrapped, and caller indentation is preserved).
- Prompt history navigation returns `null` instead of an invalid value after reaching the end of the history.
- Update checks no longer record success after a registry fetch failure, `BoundedMap.has()` works for entries whose value is `undefined`, and network-error classification for Node.js errno codes is restored. Closes #737, #738, #739.
- Renamed sessions keep their manual title when reopened in the CLI. The ACP agent rebuilt the record field-by-field on save and wasn't carrying `titleManuallySet` through, so the flag was dropped after the next message and the autosave overwrote the user's name with an auto-derived one.
- Notification titles no longer show a stale project name after `/cd`.
- `write_file` no longer echoes the full file contents back after writing. The model already authored that content as the tool call arguments, so returning it again was pure duplication that scaled with file size. The confirmation message (line, char, token counts) is unchanged.

## Under the hood

- **ACP provider discovery** after the SDK 1.3 update by including the required provider identifier.
- **The VS Code extension's stop button no longer leaves a request running.** `AcpSession.cancel()` aborted the current controller and immediately replaced it with a fresh one, so a cancel that landed before the turn read the signal handed the turn an unaborted controller and the stop was lost. The controller is now rotated when a turn begins, and stopping (or reconnecting after the agent process restarts) now resolves pending permission requests as cancelled. Closes #864. Thanks to @akramcodez.
- **Reject All runs rejections sequentially** instead of firing the async `rejectChange()` without awaiting. Overlapping cleanups raced over shared editor state; rejections now mirror `applyAll()`. Closes #725. Thanks to @jmdlrg.
- **The VS Code extension can now start the CLI on Windows.** `where.exe` lists npm's unexecutable extensionless shim before `nanocoder.cmd`, and the first line was taken blindly. Spawning a `.cmd` also fails with EINVAL because Node refuses to run one without a shell (CVE-2024-27980). Discovery ranks `where.exe` matches by extension, the CLI is launched via the JS entrypoint resolved from the shim, and a `.cmd` that cannot be resolved falls back to a quoted shell spawn. Spawn failures are caught and reported in the Nanocoder output channel instead of being swallowed as an unhandled rejection that left the UI stuck on "Connecting".
- **The VS Code extension now locates the CLI for Node version managers** (NVM, Volta, fnm, pnpm, bun). A fallback directory scan is performed when `which` / `where` cannot resolve the binary under the extension host's minimal PATH. The child-process PATH is enriched with the CLI's directory only when a co-located `node` binary is present, preventing shadowing of a user's version-manager Node. Thanks to @akramcodez.
- **New tool calls land on a fresh card** instead of an earlier card when a thought, reply, edit card, or plan update comes in between. A manually collapsed tool card no longer re-expands on its next update. One footer is reused per agent turn instead of one per text segment, and a turn's copy button no longer copies a newer turn's text. Closes #856.
- **Short user messages no longer wrap mid-word in the VS Code extension chat.** The message bubble carried `max-w-[85%]` on top of the turn wrapper's own `max-w-[85%]`, so the inner percentage resolved against the wrapper's shrink-to-fit width and squeezed each bubble to 85% of its own content. Combined with `break-words`, "hey" rendered as "he" and "y". The bubble now uses `max-w-full` and the cap lives only on the wrapper.
- Added a Nanocoder SVG pulse effect as a visual loading indicator in the VS Code extension, with a pulsing animation that indicates when the agent is processing a request.

## Install

```bash
npm install -g @nanocollective/nanocoder
nanocoder
```

If anything is broken or surprising, please open an issue or drop a note in Discord. Thank you for using Nanocoder.