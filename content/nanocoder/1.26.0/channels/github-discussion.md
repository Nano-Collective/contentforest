---
product: nanocoder
version: "1.26.0"
channel: github-discussion
title: "Nanocoder v1.26.0: nano mode, reasoning traces, and non-interactive --plain"
generated_at: "2026-05-10T17:10:04.461Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.26.0 is out. Here is what changed and why it matters.

## Nano mode: a leaner prompt for low-end hardware

The `/tune` command now offers a third tool profile called **nano mode**. It is strictly more aggressive than minimal: it drops `find_files`, `list_directory`, and `agent` from the tool set; trims `CORE PRINCIPLES` and `CODING PRACTICES` sections; uses 4-line-or-less `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` blocks; and replaces the verbose `SYSTEM INFORMATION` block with a single-line `## SYSTEM` note.

The result is a system prompt of roughly 150-250 tokens, compared to 500-700 in minimal mode. That difference matters when you are running a 1B or 3B parameter model on a machine with limited VRAM or RAM.

Nano mode ships with a "Nano (low-end hardware)" preset and an **Include AGENTS.md** toggle so you can opt back in if your setup handles it.

## Reasoning traces, live

Nanocoder now streams reasoning content from models that emit it, such as Codex GPT-5, DeepSeek-R1-style models, Anthropic extended thinking, and similar. It renders as a collapsible **Thought** block above the response, persists across the conversation history, and appears in logs.

Toggle expansion with `Control+R`. Set the default via the new **Display Settings** panel (`/settings` → "Tool Results and Thinking"). Pin it per-session from the tune menu using the `expandedReasoning` option.

`Control+R` also works for reasoning trace follow-ups, and the system ensures reasoning content survives correctly across the full conversation lifecycle.

## Non-interactive `--plain` flag

A new `--plain` flag streams output without Ink rendering, making it safe for CI pipelines, shell scripts, and programmatic pipes. Exit codes are deterministic, stdin and stdout are handled cleanly, and there are no interactive prompts.

## VS Code extension rework

The "Ask Nanocoder" command is gone. Instead, highlighted text and the currently focused file are automatically pulled into Nanocoder as context, a more natural interaction model. The extension protocol and entrypoint have been rewritten, and the development mode indicator and chat input hooks are tighter.

## Other additions

- `/rename` — rename the current chat session. Reflected in the development mode indicator.
- `defaultMode` — set a starting mode (`normal`, `auto-accept`, `yolo`, `plan`) in `agents.config.json` so you do not always launch in normal mode.
- Custom system prompt support via `agents.config.json`. Define a project-level prompt that augments or replaces built-in sections.
- Per-provider and per-model **context window overrides** via `contextWindow` and `contextWindows[model]`. Resolution order: session override (`/context-max`, `--context-max`) → provider model override → provider default → `NANOCODER_CONTEXT_LIMIT` → fallback. `/usage`, status bar, auto-compact, and context reporting all use the active provider config.
- **Subagent context window overrides** — delegated agents can run with a different context limit than the main session.
- `disabledTools` — disable specific built-in tools project-wide, honoured by both main agent and subagents.
- `--trust-directory` — bypass the first-run directory trust prompt for automation. Yolo mode already skips the validator.
- JSON tool fallback for non-tool-calling open-weights models (Qwen, Kimi, GLM). The tune menu cycles through Native ON / OFF (XML) / OFF (JSON). Includes hallucination recovery so reasoning content does not leak into rendered output.
- `<function=...>` format support in the tool-call parser.
- **Display Settings** panel — new toggles for "Show Thinking by default" and "Expand Tool Results by default", persisted to `nanocoder-preferences.json`.
- 12+ new bundled themes.

## Toolchain and configuration updates

- Node.js 22 + pnpm 11 across CI, devcontainer, and `engines.node`. `packageManager` field pins the pnpm version automatically for contributors and CI.
- `pnpm-workspace.yaml` replaces `package.json`-based pnpm config. All 16 version overrides were removed — every one was redundant under current dependency resolution.

## Fixes

- Empty model responses now trigger a capped auto-continue instead of looping or crashing.
- Context-size failures surface explicitly rather than silently retrying empty responses.
- Compressed messages persist across recursive conversation turns.
- Stream errors are thrown immediately rather than swallowed.
- Malformed XML retries are capped to prevent OOM on stuck models.
- `lastProvider` state is now correct after running the config wizard mid-session.
- File search, content search, and `@mention` autocomplete work cross-platform on Windows.
- `MCPTool.inputSchema` typed as `JSONSchema7` with an `isPlainObject` guard at the protocol boundary.
- `caCertPath` TLS configuration now applies to Anthropic and Google providers.
- Provider names resolved case-insensitively throughout.
- Quoted custom command arguments now parse as a single parameter.
- `git_pr` tool no longer requires approval in yolo mode.
- Various rendering, scheduling, and test/CI regressions fixed.

## Dependency updates

`ai` 6.0.116 → 6.0.174, `@ai-sdk/openai` 3.0.41 → 3.0.53, `@ai-sdk/google` 3.0.53 → 3.0.64, `@ai-sdk/openai-compatible` 2.0.35 → 2.0.41, `undici` 8.0.2 → 8.2.0, `react` 19.2.4 → 19.2.6, `yaml` 2.8.3 → 2.8.4, `dotenv` 17.3.1 → 17.4.2, `@nanocollective/get-md` 1.3.0 → 1.3.1, plus dev-dependency bumps.

## Breaking change

`nanocoderTools.alwaysAllow` has been removed. It duplicated the top-level `alwaysAllow` with no extra behaviour. Move any entries from `nanocoderTools.alwaysAllow` to the top-level `alwaysAllow` array in `agents.config.json`. The deprecated `agents.config.example.json` has also been removed.

---

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

https://github.com/Nano-Collective/nanocoder
