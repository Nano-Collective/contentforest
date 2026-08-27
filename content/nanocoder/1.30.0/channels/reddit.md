---
product: nanocoder
version: "1.30.0"
channel: reddit
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 5218
---

Nanocoder v1.30.0 is out. This release is mostly consolidation, and we want to walk through what's in it and why it landed the way it did.

## Everything lives in `/settings` now

The headline change is that almost every remaining CLI setting has been folded into the `/settings` menu. Settings are grouped into Appearance, Input, Behavior, Providers, MCP, and Advanced tabs. New menu items let you set the default mode, auto-compact, sessions, reasoning traces, tool auto-approval, and a Web Search API key; view your configured providers and MCP servers before opening the setup wizards; open the Tune Model and Connect IDE wizards; and see the active `NANOCODER_*` environment variables. Advanced also includes an in-app JSON editor for `agents.config.json`: edit strings with the cursor inside the quotes, flip booleans with the arrow keys, and save atomically so a crash can't leave a half-written file.

`/setup-providers` and `/setup-mcp` are sunset. Both retired names still work for now; they open the matching `/settings` tab with a notice instead of erroring. `/settings` takes a tab argument (`/settings providers`, `/settings mcp`), MCP has its own settings tab, and provider edits made from settings apply to the running session instead of waiting for the next launch.

A handful of wizard fixes rode in with this: adding a provider now lands on the wizard's root menu, which offers "Done & Save" up front; mode-specific providers are now opt-in (Done and Save goes straight to the summary, with mode providers carried through a save that skips the step); and the list selectors now highlight with the theme's `primary` colour instead of the dark blue from `ink-select-input` that ignored the active theme. Five themes were also raised to WCAG AA contrast.

## `/commit`

We added `/commit`, a slash command that generates Conventional Commit messages from your staged Git diffs using the active LLM client. `/commit --copy` (short form `-c`) copies the generated message to the system clipboard; if the clipboard is unavailable the message is still shown with a note. An unrecognised option now reports a usage line instead of being silently ignored. `/commit` also shows a spinner while the model generates the message, so the round-trip is no longer a silent pause. Closes #757. Thanks to @DeepamJha.

## Per-response usage and cost footer

Every assistant message in the CLI now ends with a subtle gray footer showing provider-reported token count and an estimated cost (for example `Tokens: 4.2k | ~$0.01`), computed from models.dev pricing. The cost segment is omitted for local and free models, and the footer falls back to the previous client-side estimate when the provider reports no usage. The VS Code extension shows the same indicator under each finished response.

The footer is optional. Turn it off under `/settings`, Behavior, Tool Results and Thinking, **Usage & Cost Footer**, or by setting `showUsageFooter` to `false` in the preferences file. Toggling it takes effect from the next response without a restart. Closes #756.

## VS Code extension

The extension saw the most user-visible work this cycle.

- **Context attachment** with file and folder chips, drag-and-drop, image pasting for multimodal messages, and a consolidated `+` menu for uploads so the UI has room to grow.
- **`@` mention autocomplete.** Typing `@` in the chat composer opens a floating dropdown of workspace files, folders, and open editors. Search runs on the extension host, which merges `files.exclude` and `search.exclude` into the exclude list. Attached files are read with a 100 KB cap and binaries are skipped. Closes #747.
- **Editor code lenses** on every function, method, constructor, and class carry `Explain Code` and `Generate Tests` links. Symbols come from the language server, and long symbols are capped before being inlined. Closes #750.
- **Chat panel shows queued work**, with rows in plain English ("Reading source/x.ts", "Running pnpm test") instead of raw tool names. Cancelling a turn settles every queued row. File edits render as their own card with an Open Diff action again.
- **Escape cancels in-flight requests** (with a `nanocoder.cancel` command added to the Command Palette), and cancelling while a tool is waiting for approval no longer wedges the chat.
- **Session management.** Sessions can be renamed from the History view via a `renameSession` ACP extension method.
- **`/settings` in the GUI.** Typing `/settings` in the VS Code chat now points at the extension's new Settings tab.

## Tool results stay inside the context window

We did a lot of work to keep tool results from re-entering model context unbounded.

- `execute_bash` and custom tools now truncate long output tail-weighted (head plus tail) instead of head-only.
- Oversized tool results are bounded before they re-enter context.
- `string_replace` and `diff_edit` results are bounded to a context window around the edited range. Closes #795. Thanks to @RealBhupesh.
- Oversized multi-file `git_diff` results are bounded to a 20-entry diffstat.
- `list_directory` no longer includes file sizes by default.
- `read_file` returns a useful preview before requiring ranged reads for very large files, and the read-before-edit refusal now specifies that files over 300 lines need a ranged read.

## Providers and fixes

Groq and OrcaRouter join the setup wizard as first-class provider templates, and the Atlas Cloud wizard now stores provider-qualified GPT-5.6 model IDs while preserving compatibility with existing shorthand configurations. Closes #803.

Other notable fixes: GitHub Copilot reasoning models no longer crash when streaming (`summaryParts` lookup now normalizes the response stream); the VS Code extension's thought dropdown now expands to actual content and groups them into a single expandable section per response; the extension's stop button no longer leaves a request running; Windows CLI startup now works (the `where.exe` discovery ranks matches by extension and a `.cmd` that cannot be resolved falls back to a quoted shell spawn); the extension locates the CLI for Node version managers (NVM, Volta, fnm, pnpm, bun); `fetch_url`'s SSRF guard blocks IPv6 loopback in addition to IPv4; and `write_file` no longer echoes the full file contents back after writing.

If anything is broken or surprising, please open an issue or drop a note in Discord. Full changelog and docs at https://github.com/Nano-Collective/nanocoder.