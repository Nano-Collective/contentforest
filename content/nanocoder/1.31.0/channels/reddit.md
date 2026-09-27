---
product: nanocoder
version: "1.31.0"
channel: reddit
generated_at: "2026-09-27T14:25:00.000Z"
model: "minimax-m3"
char_count: 9048
---

Nanocoder v1.31.0 is out. The shape of this release is trust: trust that session titles will not be silently overwritten, that prompt caching actually fires (and bills at cache rates, not full input rates), that bracketed paste works properly in the terminal, and that the agent loop will not silently spend your tokens calling a tool that does not exist. We want to walk through what changed and why.

## Anthropic prompt caching, with cache-aware cost reporting

Multi-turn Anthropic sessions now mark the system prompt, tool schemas, and conversation history with cache breakpoints, so the stable prefix is read back out of cache instead of being paid for at full price every turn. Cost reporting is cache-aware throughout: `/usage` and the per-response indicator now price cache reads and writes at their own rates instead of billing every cache hit at the full input rate, and the per-response indicator surfaces the cached token count alongside the total. Opt out with `"promptCaching": false` on the provider config. Closes #888.

## The fix for multi-line paste submitting partway through

Pasting two lines into the prompt used to send the first line to the model and leave the second in the input box. Nanocoder never enabled bracketed paste, so the terminal delivered a paste as bare bytes and the carriage return at each line break reached Ink's keypress parser as Enter. Paste handling relied on heuristics (input rate, size, line count) that only ever saw text that had already made it into the buffer.

`DECSET 2004` is now enabled in both screen modes. Paste payloads are lifted off stdin before Ink sees them and delivered to the input as a single event, so a pasted newline can no longer submit. The old heuristics remain as a fallback for terminals without bracketed paste support.

Fullscreen mode enables mouse reporting for wheel scrolling, which takes click-drag text selection away from the terminal. Selection there is `Shift+drag` (`Option+drag` in iTerm2), or turn mouse reporting off for the session with `--no-mouse`.

## Automatic session titles

A session keeps its opening prompt as the title, and when that prompt is too thin to be useful the agent generates a descriptive name once, after the first turn that ran a tool or the first follow-up message. Manual renames are never overwritten.

Titling runs in the ACP agent, so it applies to the VS Code extension and other ACP clients; the CLI keeps its heuristic title. It uses the session's own model by default. Set `sessions.titleModel` / `sessions.titleProvider` to point it at a cheaper or local one, or `sessions.smartTitles: false` to turn it off. Pointing `titleProvider` at a different provider sends it the opening user turns and a summary of the tools that ran, which includes file paths and bash command strings.

Two things worth knowing: the tokens a title costs are billed by the provider but are not counted in `/usage`, since the call is made outside the conversation loop that builds usage records; and existing sessions are retitled from their first message on their next autosave, which is a one-time visible reshuffle of the history list. Also fixed the CLI's autosave deriving the session title from the latest user message and rewriting it on every save, which overwrote titles in the store the VS Code extension reads from. Closes #808.

## Configurable agent-loop retry limits to prevent token drain

Three previously hardcoded caps now live in a new `nanocoder.retries` section of `agents.config.json`: `maxRepeatedToolCalls` (default 3), `maxEmptyTurns` (default 2), and `maxMalformedRetries` (default 2). When the repeated-tool-call limit is hit in an interactive session, Nanocoder pauses and asks whether to continue or stop, instead of always hard-stopping. Non-interactive runs keep the hard stop.

The same limits now also protect the `--plain` runtime used by `nanocoder run` in CI and non-TTY environments, which previously had no repeated-call cap at all. `--plain` used to return an error on the first empty response and on the first malformed tool call, and now nudges or asks the model to self-correct up to `maxEmptyTurns` / `maxMalformedRetries` before stopping, so a silent or malformed-output model costs up to 3 model calls instead of 1. Set either limit to `0` to restore the old fail-fast behaviour. Closes #897.

Calls to unknown tools count toward the repeated-call streak in both runtimes, so a model stuck on a nonexistent tool trips the same cap instead of looping until the turn ceiling. Delegated subagent runs (which previously had no cap at all) now apply `maxRepeatedToolCalls` too.

## Closed the remaining routes by which Nanocoder's UI text reached the model

Another class of regressions traced back to the same root cause: harness-authored markdown pushed into conversation history as plain `assistant` messages, so on the next turn the provider received it as if the model had written it. Cancellation notices (`_Cancelled by user._`), inline error banners, the non-interactive "Tool approval required" notice, and VS Code replies to built-in slash commands are now marked display-only. The ACP timeline-revert notice and `/compact` notices are excluded from the summarised segment; context estimates count only what the provider actually receives. Closes #893.

## `nanocoder config` and `.nanocoderignore`

Settings come from four places: built-in defaults, your global config folder, the project folder you're in, and `NANOCODER_*` environment variables. Three new commands (`nanocoder config list|show|diff`, all with `--json`) show you which file set each one.

Patterns in `.nanocoderignore` keep tracked-but-noisy files (lockfiles, generated fixtures) out of directory listings, file search, and the file explorer, so they stop eating context even though `.gitignore` does not cover them. It is a context-hygiene tool rather than a secrets boundary: `read_file` and `execute_bash` do not consult it, and checkpoints deliberately skip it so hidden files are still snapshotted and restored. Closes #755.

## JSON Schema, `/export --json`, Cheaper Inference, and a `showAgentBashOutput` preference

A JSON Schema is published at `schemas/agents.config.schema.json`, generated deterministically from the on-disk `DiskConfig` type. JSON exports are available via `/export --json` and `.json` filenames. Closes #1309.

Cheaper Inference, an OpenAI-compatible gateway, has a first-class provider template in the `/settings providers` wizard with the base URL pre-filled and the model list fetchable over `/models`.

`showAgentBashOutput`, under `/settings` → Behavior → Tool Results and Thinking, shows a completed command card's output whether compact tool display is on or off, and for failed commands too. Commands typed by the user (`!command`) always show their output and are unaffected.

## `$` and PDFs no longer corrupt edits

`string_replace` and `diff_edit` passed the replacement straight to `String.prototype.replace`, which treats the argument as a substitution template: `$$` collapsed to `$`, `$&` expanded to the matched text, and `` $` `` / `$'` spliced half the file into the middle of the edit. Shell scripts, Makefiles, and CI YAML are full of `$`, so bytes on disk diverged from the approved diff. Replacements are now spliced by index. Closes #1057.

`read_file` returns a markdown transcript for `.pdf` and `.docx` rather than the bytes, and the write side had no matching branch: a request to fix one word replaced the document with a few hundred bytes of plain text. `write_file`, `string_replace`, and `diff_edit` now refuse any path whose content the read path can only transcribe. Closes #1058.

## Other notable fixes

- **VS Code companion WebSocket auth.** The companion server bound to a fixed loopback port (`51820`) and accepted every upgrade, so any local process could deliver `{"type":"send_prompt", ...}` straight into a running agent. The server now mints a 256-bit bearer token.
- **Parallel subagents no longer hang on the first approval prompt.** Closes #1156.
- **`--context-max` and `/context-max` reject malformed values.** Closes #973.
- **Provider settings `promptCaching` and `maxRetries`** now take effect when set in `agents.config.json`; both were documented but dropped when provider entries were loaded.
- **`nanocoder run` exits 1 on failure**, so CI can tell a failed run from a finished one.
- **Prompt scrubbing now applies everywhere** -- `--plain`, ACP (including the VS Code extension), subagents, and compaction.
- **`list_directory` and the file explorer** hide a directory matched by a directory-only ignore pattern like `dist/` or `node_modules/`.
- **Truncated tool output no longer leaks part of a secret.** Cuts now avoid splitting whitespace-separated tokens.
- **The MCP setup wizard** shows hand-written `.mcp.json` servers by name.
- **macOS native notifications** no longer break on newlines, quotes, backslashes, or Unicode characters. Closes #1139.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.
