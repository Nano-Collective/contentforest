---
product: nanocoder
version: "1.31.0"
channel: github-discussion
title: "Nanocoder v1.31.0: Anthropic caching, auto titles, retry caps, .nanocoderignore"
generated_at: "2026-09-27T14:25:00.000Z"
model: "minimax-m3"
char_count: 16691
---

Nanocoder v1.31.0 is out. The shape of this release is trust: trust that session titles will not be silently overwritten, that prompt caching actually fires (and bills at cache rates, not full input rates), that bracketed paste works properly in the terminal, and that the agent loop will not silently spend your tokens calling a tool that does not exist. Plus a new provider template (Cheaper Inference), a published JSON Schema for `agents.config.json`, `.nanocoderignore` for context hygiene, configurable retry limits, real `nanocoder config list|show|diff` introspection, and a long list of fixes that mostly stop the model from being lied to about its own UI.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Full changelog and docs at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## Anthropic prompt caching, and cost reporting that knows about it

Multi-turn Anthropic sessions now mark the system prompt, tool schemas, and conversation history with cache breakpoints, so the stable prefix is read back out of cache instead of being paid for at full price every turn. Cost reporting is cache-aware throughout: `/usage` and the per-response indicator price cache reads and writes at their own rates instead of billing every cache hit at the full input rate, and the per-response indicator surfaces the cached token count alongside the total.

Opt out with `"promptCaching": false` on the provider config. Closes #888.

## The fix for multi-line paste submitting partway through

Pasting two lines into the prompt used to send the first line to the model and leave the second in the input box. Nanocoder never enabled bracketed paste, so the terminal delivered a paste as bare bytes and the carriage return at each line break reached Ink's keypress parser as Enter. Paste handling relied on heuristics (input rate, size, line count) that only ever saw text which had already made it into the buffer.

`DECSET 2004` is now enabled in both screen modes. Paste payloads are lifted off stdin before Ink sees them and delivered to the input as a single event, so a pasted newline can no longer submit. The old heuristics remain as a fallback for terminals without bracketed paste support.

Fullscreen mode enables mouse reporting for wheel scrolling, which takes click-drag text selection away from the terminal. Selection there is `Shift+drag` (`Option+drag` in iTerm2), or turn mouse reporting off for the session with `--no-mouse`.

## Automatic session titles

A session keeps its opening prompt as the title, and when that prompt is too thin to be useful the agent generates a descriptive name once, after the first turn that ran a tool or the first follow-up message. Manual renames are never overwritten.

Titling runs in the ACP agent, so it applies to the VS Code extension and other ACP clients; the CLI keeps its heuristic title. It uses the session's own model by default. Set `sessions.titleModel` / `sessions.titleProvider` to point it at a cheaper or local one, or `sessions.smartTitles: false` to turn it off. Pointing `titleProvider` at a different provider sends it the opening user turns and a summary of the tools that ran, which includes file paths and bash command strings.

Two things worth knowing: the tokens a title costs are billed by the provider but are not counted in `/usage`, since the call is made outside the conversation loop that builds usage records; and existing sessions are retitled from their first message on their next autosave, which is a one-time visible reshuffle of the history list.

Also fixed the CLI's autosave deriving the session title from the latest user message and rewriting it on every save, which overwrote titles in the store the VS Code extension reads from. Closes #808.

## Configurable agent-loop retry limits to prevent token drain

Three previously hardcoded caps now live in a new `nanocoder.retries` section of `agents.config.json`:

- `maxRepeatedToolCalls` (default 3) is the number of times the same tool can be called before the loop pauses or stops.
- `maxEmptyTurns` (default 2) is the number of empty model responses tolerated before the loop pauses or stops.
- `maxMalformedRetries` (default 2) is the same cap for malformed tool calls.

When the repeated-tool-call limit is hit in an interactive session, Nanocoder pauses and asks whether to continue (granting another window of attempts) or stop, instead of always hard-stopping. Non-interactive runs keep the hard stop.

The same limits now also protect the `--plain` runtime used by `nanocoder run` in CI and non-TTY environments, which previously had no repeated-call cap at all: each cap hard-stops with a clear error there. Note this also loosens `--plain` in two places. It used to return an error on the first empty response and on the first malformed tool call, and it now nudges or asks the model to self-correct up to `maxEmptyTurns` / `maxMalformedRetries` before stopping, so a silent or malformed-output model costs up to 3 model calls instead of 1. Set either limit to `0` to restore the old fail-fast behaviour.

Calls to unknown tools count toward the repeated-call streak in both runtimes, so a model stuck on a nonexistent tool trips the same cap instead of looping until the turn ceiling. Delegated subagent runs, whose loop previously had no cap at all, now apply `maxRepeatedToolCalls` too and stop with an error naming the setting.

One change reaches further than the retry limits themselves: a tool call naming a tool that does not exist is now kept in the assistant message's `tool_calls` rather than dropped from it. Without this the paired `Unknown tool: X` result was orphaned and pruned before the request went out, so the self-correction hint never reached the model and it re-emitted the same nonexistent call. This applies to all three runtimes that partition tool calls, including the ACP loop (`--acp`, used by editor clients), which is otherwise unaffected by the retry limits. The practical consequence is that providers now receive a tool call naming a tool that was not in the request's tool list. Closes #897.

## `nanocoder config` to see your settings and which file set each one

Settings come from four places: built-in defaults, your global config folder, the project folder you're in, and `NANOCODER_*` environment variables. When a setting did not do what you expected, finding out which file set it meant opening all four by hand.

Three commands:

- `nanocoder config list` shows every setting, its value, and the file it came from.
- `nanocoder config show <key>` shows one setting in detail, including its default and any values it beat.
- `nanocoder config diff` shows only what your files change, plus values that are set but unused.

All three take `--json`.

## `.nanocoderignore`

Patterns in `.nanocoderignore` keep tracked-but-noisy files (lockfiles, generated fixtures) out of directory listings, file search, and the file explorer, so they stop eating context even though `.gitignore` does not cover them. It is a context-hygiene tool rather than a secrets boundary: `read_file` and `execute_bash` do not consult it, and checkpoints deliberately skip it so hidden files are still snapshotted and restored. Thanks to @A-S-Manoj. Closes #755.

## JSON Schema for `agents.config.json`

A JSON Schema is now published at `schemas/agents.config.schema.json`. It is generated deterministically from the on-disk `DiskConfig` type (`pnpm run generate:schema`), ships with an Ajv validation suite plus a CI drift check, and enables editor autocompletion either by dropping the `$schema` key into your config or by wiring up the schema via `jsonValidation` / a JSON Schema mapping in your editor.

## `/export --json` and `.json` filenames

JSON exports are now available via `/export --json` and `.json` filenames, preserving full message content and session metadata for replay and evaluation workflows. Closes #1309.

## Cheaper Inference in the provider wizard

A first-class provider template for Cheaper Inference, an OpenAI-compatible gateway, has been added to the `/settings providers` wizard. Selecting it fills in the base URL (`https://api.cheaperinference.com/v1`) so only an API key and a model name are needed, and the wizard can fetch the account's model list over the standard `/models` endpoint.

## VS Code extension: grouped work summaries

Each VS Code chat turn's thoughts, tool calls, edit cards, and task plan are now grouped into one ordered, collapsible work summary while the final answer stays visible. The summary reports completed, stopped, or failed duration and reopens for pending approvals. Thanks to @Gambit-Checkmate. Closes #858.

## Closed the remaining routes by which Nanocoder's UI text reached the model

A class of regressions traced back to the same root cause: harness-authored markdown being pushed into conversation history as plain `assistant` messages, so on the next turn the provider received it as if the model had written it, and taught it to imitate the chrome. Three changes close the remaining routes.

`Cancellation notices` (`_Cancelled by user._`), inline error banners (`**Error:** ...`), the non-interactive "Tool approval required" notice, and the VS Code replies to built-in slash commands (`/help`, `/copy`, `/model`, unrecognised commands) are now marked display-only. They still render in the chat and replay with session history, but they are filtered out before messages are converted to the provider payload. Closes #893.

The ACP timeline-revert notice ("Reverted to before step N...") is no longer pushed into history as a plain assistant message. `/compact` (and auto-compact) previously fed display-only notices into the LLM summariser, whose summary re-enters context as a real `user` message, so a compacted session could still be told it had errored. Notices are now excluded from the summarised segment, and context-usage estimates and the auto-compact threshold count only what the provider actually receives.

The `Message` shape now also documents a `displayOnly` contract, warns when a display-only message carries `tool_calls` (which would silently drop its tool results from the payload), and shares the "Tool approval required for: " prefix as a constant so the non-interactive exit-code path cannot break on a reword.

## `$` in `string_replace`/`diff_edit` no longer corrupts edits (#1057)

Both tools passed the model's replacement straight to `String.prototype.replace`, which treats that argument as a substitution template rather than a literal: `$$` collapsed to a single `$`, `$&` expanded to the matched text, and ```$` ``` / `$'` spliced a whole half of the file into the middle of the edit. Those are ordinary characters in shell scripts, Makefiles, CI YAML and anything that builds a regex, so the bytes on disk silently diverged from the diff the user approved.

Replacements are now spliced by index, so the approved preview (in the terminal and over ACP) is what lands. Closes #1057.

## Write tools refuse PDF and DOCX (no more document corruption) (#1058)

`read_file` returns a markdown transcript for `.pdf` and `.docx` rather than the bytes on disk, and the write side had no matching branch. The edit was applied to the transcript and written back over the document as UTF-8, so a request to fix one word replaced a real document with a few hundred bytes of plain text and the tool reported success. Neither undo system could recover it - checkpoints skip binaries and file snapshots store text - so the original bytes were gone the moment the write landed.

`string_replace`, `diff_edit`, and `write_file` now refuse any path whose content the read path can only transcribe, naming the reason so the model stops instead of retrying. Closes #1058.

## `showAgentBashOutput` preference

A new `showAgentBashOutput` preference lives under `/settings` → Behavior → Tool Results and Thinking. By default a completed card for a command the agent runs shows the command and its status, and the command output is not kept. With compact tool display on, the card collapses into a tally line. This preference shows the output on that card, whether compact tool display is on or off, and for failed commands too. Commands typed by the user (`!command`) always show their output and are unaffected.

## Other notable fixes

- **VS Code companion WebSocket auth.** The companion server bound to a fixed loopback port (`51820`) and accepted every upgrade, so any local process or browser tab could deliver `{"type":"send_prompt", ...}` straight into a running agent and read every broadcast the server pushed out. The server now mints a 256-bit bearer token and rejects unauthenticated cross-origin requests.
- **Parallel subagents no longer hang on the first approval prompt.** The three "ask the user" slots each held a single resolver, so a second caller arriving before the first was answered overwrote it and that first promise could never settle. `tool-executor` starts up to five subagents in one turn and awaits them with `Promise.allSettled`, so one stranded caller meant the batch never resolved, the turn never ended, and Escape could not free it. Each slot now queues requests in arrival order and presents them one at a time. Closes #1156.
- **`--context-max` and `/context-max` reject malformed values.** `10kg` used to parse as `10` and `128kb` as `128`, so a typo quietly set a context limit nothing like the one you asked for. Values are now validated as a whole, and anything that is not a positive number with an optional `k`/`K` suffix is rejected with the existing error message. Closes #973.
- **Custom command `args` now receive the arguments exactly as typed.** They were rebuilt from shell-style parsed tokens, so quotes were stripped and an apostrophe opened a quote: `/cmd don't break it` reached the model as `dont break it`. Declared positional parameters still use the parsed tokens.
- **Provider settings `promptCaching` and `maxRetries` now take effect.** Both were documented but dropped when provider entries were loaded, so `"promptCaching": false` still sent Anthropic cache breakpoints and a custom `maxRetries` always fell back to 2.
- **`nanocoder run` now exits with code 1 on failure.** A provider or connection error, or a stop by `nanocoder.retries` (repeated tool calls, empty responses, malformed tool calls), used to exit 0 because the runtime looked for an error-role message that nothing ever produces. CI could not tell a failed run from a finished one. `--plain` already reported these correctly.
- **Prompt scrubbing now applies everywhere.** The setting was only passed to the model client by the interactive chat, so `nanocoder --plain`, ACP sessions (including the VS Code extension), subagents and helper calls such as compaction sent secrets from files, command output and tool results to the provider unscrubbed.
- **`list_directory` and the file explorer now hide a directory matched by a directory-only ignore pattern** such as `dist/` or `node_modules/` in `.gitignore` or `.nanocoderignore`. Its contents were already hidden, but the folder itself still listed, and listing it then reported it as empty.
- **Truncated tool output no longer leaks part of a secret.** Bash output is cut to fit before scrubbing runs, and a cut through the middle of a key left a fragment such as `sk-live-abcdef1234` that no detector recognises, so it went to the provider even with scrubbing on. Cuts now avoid splitting whitespace-separated tokens, so a secret is either kept whole, where it gets scrubbed, or dropped entirely.
- **The MCP setup wizard shows hand-written `.mcp.json` servers by name.** A server defined only by its JSON key was listed as a blank "•  (stdio)", the "Added:" line began with a stray comma, and its edit form opened with an empty name.
- **The empty `/resume` picker** now reads "Press Esc to close" instead of the contradictory "Press Escape to continue • Esc to cancel".
- **The last row of a markdown table** was being left outside the rendered table as raw `| a | b |` text whenever the table ended the reply. The table pattern required a newline after every row, and replies are trimmed.
- **macOS native notifications** no longer break when title or message contains newlines, quotes, backslashes, or Unicode characters; arguments are passed out of band to `osascript`. Closes #1139.

## Install

```bash
npm install -g @nanocollective/nanocoder
nanocoder
```

If anything is broken or surprising, please open an issue or drop a note in Discord. Thank you for using Nanocoder.
