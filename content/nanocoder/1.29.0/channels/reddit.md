---
product: nanocoder
version: "1.29.0"
channel: reddit
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-07-28T21:05:22.075Z"
---

We just shipped Nanocoder v1.29.0, and this one felt worth writing up. The headline is a native VS Code GUI: the extension now spawns and drives `nanocoder --acp` itself, so there is nothing to run in a terminal. Sessions persist, slash commands work, interactive tools render as buttons, and a resumed thread looks like the conversation you left. Legacy WebSocket companion mode is now opt-in.

Underneath that there are a few things we have wanted to ship for a while. You can now press `Ctrl+S` to attach to a running subagent and watch what it is doing in real time, including streaming text and reasoning, and `Ctrl+S` cycles through multiple parallel subagents reliably. Press `Esc` to detach.

A new `PrivacyContext` scrubs sensitive content out of prompts before they leave your machine, with tool-argument rehydration, privacy session support, a `/privacy` command to inspect what is being scrubbed, and automated scrubbing telemetry notifications. Each development mode (normal, auto-accept, yolo, plan) can now have its own provider and model, so the cheap local model you chat with is not the one you accidentally burn through on a long refactor. Plan mode can now ask you structured questions via `ask_user` while it is planning, with one button per answer, instead of guessing around ambiguity.

## TUI work

A lot of quality-of-life fixes to the terminal UI this cycle:

- Dual screen modes (`--alt-screen` and inline) both render correctly, and `/clear` is more reliable.
- Multiline cursor navigation and word-jump in the input box.
- Fuzzy search in the `/model` picker, with a capped, centered scrolling window so large catalogs no longer overflow the terminal.
- Tabbed `/settings` dialog with searchable categories.
- Fixed static vs. live content misalignment in `--alt-screen` mode so the transcript and the input/tools footer line up cleanly.
- `ask_user` cleanup: emoji badges removed from the question type, and the tool result now always renders the full Question/Answer block even in compact display mode.
- Command suggestions appear as soon as you type `/`, and Tab selects the highlighted suggestion. Recalling a `/command` from history with the arrow keys no longer opens the menu.
- Image attachments now leave an `[Image #N]` placeholder in the message instead of being silently stripped.
- `Ctrl+S` cycles between parallel subagent sessions reliably, with the attached transcript remounted per agent.

## Smaller but useful

- `--continue` (`-c`) resumes the most recent session for the current directory. `--resume [id]` (`-r`) resumes a session by id, list index, or `last`, with a bare `--resume` opening the session picker at startup.
- A `/doctor` command checks your setup and reports common configuration problems.
- A `/retry` command re-runs the last user turn.
- A `--json` output flag for the non-interactive plain run path.
- A `diff_edit` tool for nano-profile models that struggle with `string_replace`.
- PDF and DOCX support in `read_file` via get-md.
- Estimated dollar cost tracking in `/usage`, with a per-provider breakdown.
- Message queueing while the agent is busy, so you can type ahead. Queued messages can be recalled before streaming, are truncated properly on narrow terminals, and no longer double-dispatch.

## Under the hood

- The client now treats the model as a stateless endpoint and rehydrates conversation history at history boundaries, which improves reliability across reconnects and provider restarts.
- Foundation for semantic memory (storage layer and initial wiring).
- File tools resolve relative paths against the shell's current working directory, and `cd` in bash persists across commands, so relative reads and edits work after moving into a subdirectory or worktree.
- Automatic diagnostics after file edits surface errors introduced by an edit right away.

## Providers

- Together AI joins the provider template list with first-class docs.
- MiniMax Coding now defaults to MiniMax-M3.
- Atomic Chat has new local provider configuration docs.
- Thesean AI is added as a provider template, with Anthropic-compatible Claude models (`ship-like/claude-opus-4-8`, `ship-like/claude-sonnet-5`, `ship-like/claude-haiku-4-5`) and a new docs page.

## Fixes worth calling out

- `nanocoder.tune` loading and configuration precedence from `agents.config.json` now resolve correctly.
- Malformed SSE termination strings from providers are now patched, preventing stream parsing errors.
- Slash command completions are bounded so the menu no longer overflows.
- Console log verbosity is decoupled from `NODE_ENV`, and noisy LSP discovery logs are quieted.
- The `strip-ansi` runtime dependency is gone.
- Provider configuration loading preserves existing providers and falls back to a working provider on startup instead of freezing.

## Documentation

- Simplified Chinese README and Traditional Chinese translations, with fixes to the Simplified Chinese copy, plus a star-history chart.
- A typing SVG in the README.
- VS Code extension docs rewritten around the GUI.

## Who this is for

If you have been waiting for an editor-native experience, the new VS Code GUI is the headline. If you have been frustrated that subagents are opaque while they run, `Ctrl+S` to attach fixes that. If you have wanted to keep more of your prompt out of a cloud provider, `PrivacyContext` is the answer. If you have wanted a different model for `yolo` than for `plan`, mode-specific provider and model configuration is finally here.

Repo, changelog, and docs are at https://github.com/Nano-Collective/nanocoder. We would love to hear what breaks or what is missing.