---
product: nanocoder
version: "1.29.0"
channel: github-discussion
title: "Nanocoder v1.29.0: native VS Code GUI, subagent attach, prompt scrubbing"
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 0
---

Nanocoder v1.29.0 is out. The headline is a native VS Code GUI powered by the Agent Client Protocol: the extension now spawns and drives `nanocoder --acp` itself, so there is nothing to run in a terminal. Alongside that: you can press `Ctrl+S` to attach to a running subagent session and watch what it is doing in real time, a new `PrivacyContext` scrubs sensitive content out of prompts before they leave your machine, and each development mode can now have its own provider and model.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Full changelog and docs at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Native VS Code GUI

The biggest change in this release is that the VS Code extension now ships a full sidebar chat, not a companion window. The extension spawns and manages `nanocoder --acp` itself, so the only thing in the terminal is whatever you were already doing. Responses stream into a sidebar webview with collapsible thinking sections, tool activity renders as live cards, and file edits open in VS Code's diff viewer.

Behind the scenes this is the Agent Client Protocol (ACP) plumbing added in v1.28.0, now with a real editor on top. Concretely:

- **Sessions persist to disk.** New Chat, a session history view with resume and delete, and full thread replay (including thinking and completed tool cards) on resume. A resumed thread looks like the conversation you left, not an empty screen.
- **Provider, model, and mode switching** from dropdowns in the chat header. The model list refreshes when you switch provider.
- **Slash commands work in the GUI.** `/help`, `/clear`, and any custom commands from `.nanocoder/commands`. CLI-only commands explain themselves rather than failing silently. Messages that start with file paths are not mistaken for commands.
- **Interactive tools render properly.** `ask_user` questions render with one button per answer. Tool approvals show Approve/Deny inline instead of a terminal prompt.
- **Live progress.** Subagent runs stream token and tool counts onto their card. The task tool (`write_tasks`) renders as a live checklist via ACP `plan` updates, which also lights up in other ACP clients like Zed.
- **Cancellation works end to end.** Stop ends the whole turn: the current tool aborts, queued tools are skipped, and no follow-up model request is issued.
- **Robust CLI spawning.** The extension resolves the login shell's PATH (nvm-friendly when VS Code launches from the Dock), runs the CLI in the workspace folder, validates `nanocoder.cliPath`, and surfaces the last stderr line in the crash dialog. A silent `--acp` startup crash when the working directory was unwritable is fixed.

Legacy WebSocket companion mode is now opt-in (`nanocoder.autoConnect` defaults to off), and the extension docs have been rewritten around the GUI.

Thanks to @akramcodez and @Dhirenderchoudhary for the build.

## Attach to a running subagent

Subagents have been useful but opaque: they run in their own context and you only saw the result when they finished. v1.29.0 lets you attach to a running subagent from the terminal UI and inspect exactly what it is doing, including streaming text and reasoning, in real time.

- Press `Ctrl+S` while a subagent is running to attach to it.
- If multiple subagents are running in parallel, `Ctrl+S` cycles through them.
- Press `Esc` to detach and return to the parent.

Under the hood this needed two fixes that were easy to miss. The attached-session transcript renders through Ink's append-only `<Static>`, so switching agents never printed the new agent's messages; the view is now remounted per agent with a terminal wipe (the same treatment `/clear` uses), and rapid `Ctrl+S` presses cycle reliably. Thanks to @llupRisinglll.

## Privacy-aware prompt scrubbing

A new `PrivacyContext` scrubs sensitive content from prompts before they leave your machine. Tool arguments are rehydrated locally after the response comes back, so the model still sees the values it needs while the cloud provider only ever sees placeholders. There is also:

- **Privacy session support.** Scrubbed placeholders stay stable within a session so re-prompts and follow-ups keep working.
- **A `/privacy` command** to inspect what is being scrubbed in the current session, with the active rule pack and a sample of recent scrub events.
- **Automated scrubbing telemetry notifications** so you see when something is being scrubbed rather than it happening silently.

Thanks to @akramcodez.

## Mode-specific provider and model configuration

You can now bind a different provider and model to each development mode (normal, auto-accept, yolo, plan), so the cheap local model you use for chat is not the one you accidentally burn through with `--mode yolo` on a long refactor. The configuration lives in `agents.config.json` under a per-mode block and re-resolves live when you switch modes.

Closes #277. Thanks to @akramcodez.

## Interactive questions in plan mode

Plan mode used to plan around ambiguity by guessing. v1.29.0 lets the agent ask structured questions via `ask_user` while it is planning, with one button per answer, so it can resolve open questions instead of inventing answers. The questions render inline in the GUI and as a normal `ask_user` prompt in the terminal UI. Closes #96. Thanks to @akramcodez.

## TUI refinements

A grab bag of quality-of-life fixes to the terminal UI:

- **Dual screen modes.** `--alt-screen` (fullscreen with in-app scrolling) and the inline default both render correctly. `/clear` is more reliable and exits cleanly. Thanks to @llupRisinglll.
- **Multiline cursor navigation and word-jump** in the input box, with sane behavior on narrow terminals. Thanks to @llupRisinglll.
- **Fuzzy search in the `/model` picker**, with a capped, centered scrolling window so large model catalogs no longer overflow the terminal. The current model is preselected. Closes #683. Thanks to @rakshith1928.
- **Tabbed `/settings` dialog** with searchable categories, so settings are easier to scan and filter from the TUI. Closes #471. Thanks to @llupRisinglll.
- **Fixed static vs. live content misalignment in `--alt-screen` mode.** The chat transcript and the input/tools footer now share the same left column, so assistant messages, tool results, and the input line up cleanly. The fix moves the footer out to the transcript's padded column rather than pushing the transcript into the scroll viewport's clip window (which was clipping the first character of each line).
- **`ask_user` cleanup.** Emoji badges removed from the question type, and the tool result now always renders the full Question/Answer block even in compact tool display mode, instead of folding into the tool tally and hiding what was answered.
- **Command suggestions on `/`.** The completion menu now appears as soon as you type `/`, and Tab selects the highlighted suggestion. Previously the menu was Tab-triggered and often failed to render, especially in alternate-screen mode. Recalling a `/command` from history with the arrow keys no longer opens the menu, so up/down keep navigating history freely; the menu returns as soon as you type.
- **Image attachments leave an `[Image #N]` placeholder** in the message. Dragged or typed image paths are no longer silently stripped; each becomes a numbered `[Image #N]` placeholder (mirroring the `[Paste #N]` convention), numbered after any images already attached via Ctrl+V, and highlighted in the chat history like `[@file]` mentions.

## Session resume, CLI flags

`--continue` (`-c`) resumes the most recent session for the current directory. `--resume [id]` (`-r`) resumes a session by id, list index, or `last`, with a bare `--resume` opening the session picker at startup. Thanks to @llupRisinglll.

## New commands and flags

- **`/doctor`** checks your setup and reports common configuration problems (missing binaries, broken config files, stale model caches). Closes #609. Thanks to @Dhirenderchoudhary.
- **`/retry`** re-runs the last user turn without retyping the prompt. Closes #608. Thanks to @Dhirenderchoudhary.
- **`--json` output flag** for the non-interactive plain run path, for piping Nanocoder into other tools. Thanks to @OMEE-Y.
- **`diff_edit` tool** for nano-profile models, so very small local models that struggle with `string_replace` have a more forgiving edit primitive. Closes #604. Thanks to @Dhirenderchoudhary.

## Under the hood

- **Stateless API with history-boundary rehydration.** The client now treats the model as a stateless endpoint and rehydrates conversation history at history boundaries, which improves reliability across reconnects and provider restarts. Thanks to @akramcodez.
- **Foundation for semantic memory** (storage layer and initial wiring), groundwork for upcoming memory features. Thanks to @Dhirenderchoudhary.
- **File tools resolve relative paths against the shell's current working directory**, and `cd` in bash persists across commands, so relative reads and edits work after moving into a subdirectory or worktree. File tools also accept absolute paths that point inside the project, and can still reach the project root or a sibling worktree after `cd`-ing into a subdirectory.
- **Automatic diagnostics after file edits** surface errors introduced by an edit right away, in the same render pass. Closes #538. Thanks to @2409324124.
- **Message queueing while the agent is busy** so you can type ahead. Queued messages can be recalled before streaming, are truncated properly on narrow terminals, and no longer double-dispatch. Closes #597, #598. Thanks to @Dhirenderchoudhary.
- **Estimated dollar cost tracking in `/usage`**, with a per-provider cost breakdown and a cumulative per-call cost history. Closes #602. Thanks to @rakshith1928.
- **PDF and DOCX support in `read_file`** via get-md, so those documents can be read directly into the conversation. Thanks to @akramcodez.

## Providers

- **Together AI** joins the provider template list with first-class docs. Thanks to @octo-patch.
- **MiniMax Coding now defaults to MiniMax-M3**. Thanks to @octo-patch.
- **Atomic Chat** has new local provider configuration docs. Thanks to @yanalialiuk.
- **Thesean AI** is added as a provider template. The `/setup-providers` wizard includes Thesean's Ship endpoint with Anthropic-compatible Claude models (`ship-like/claude-opus-4-8`, `ship-like/claude-sonnet-5`, `ship-like/claude-haiku-4-5`), plus a new docs page covering configuration and available models.

## Fixes

- **`nanocoder.tune` loading and configuration precedence** from `agents.config.json` now resolve correctly. Closes #648. Thanks to @rakshith1928.
- **Malformed SSE termination strings from providers** are now patched, preventing stream parsing errors. Closes #614. Thanks to @akramcodez.
- **Slash command completions are bounded** so the menu no longer overflows. Closes #624. Thanks to @2409324124.
- **Console log verbosity is decoupled from `NODE_ENV`**, and noisy LSP discovery logs are quieted. Closes #606. Thanks to @A-S-Manoj.
- **Removed the `strip-ansi` runtime dependency.** Closes #643. Thanks to @2409324124.
- **Provider configuration loading** preserves existing providers and falls back to a working provider on startup instead of freezing. Thanks to @llupRisinglll.

## Documentation

- Simplified Chinese README and Traditional Chinese translations, with fixes to the Simplified Chinese copy, plus a star-history chart. Thanks to @2409324124, @jason1015-coder, and @zerone0x.
- A typing SVG in the README showing "Meet Nanocoder" and "your private, local first AI coding assistant". Thanks to @jason1015-coder.
- VS Code extension docs rewritten around the GUI.

## Dependency updates

`@ai-sdk/google`, `@ai-sdk/openai-compatible`, `undici`, `diff`, and `knip`.

The VS Code extension saw major work this cycle (ACP process manager and handshake, a chat sidebar webview with tool-permission and diff UI, session persistence, and Tailwind styling). It is versioned separately from the CLI. Thanks to @akramcodez and @Dhirenderchoudhary.

If anything is broken or surprising, please open an issue or drop a note in Discord. Thank you for using Nanocoder.