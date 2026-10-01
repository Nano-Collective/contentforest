---
product: nanocoder
version: "1.31.0"
channel: linkedin
generated_at: "2026-09-27T14:25:00.000Z"
model: "minimax-m3"
char_count: 3332
distributed_at: "2026-10-01T16:57:57.118Z"
---

Nanocoder v1.31.0 is out. The theme of this release is trust: session titles that are not silently overwritten, prompt caching that actually fires (and bills at cache rates, not full input rates), bracketed paste that works properly, and an agent loop that will not silently spend your tokens calling a tool that does not exist.

Anthropic sessions now mark the system prompt, tool schemas, and conversation history with cache breakpoints, so the stable prefix is read from cache instead of being paid for in full every turn. Cost reporting is cache-aware throughout: `/usage` and the per-response indicator price cache reads and writes at their own rates, and the indicator surfaces the cached token count alongside the total.

Multi-line paste no longer submits partway through. Nanocoder now enables `DECSET 2004` (bracketed paste) in both screen modes, so paste payloads are lifted off stdin before Ink sees them and delivered to the input as a single event. Pasting two lines is no longer a round-trip.

A new `nanocoder.retries` section in `agents.config.json` exposes the previously hardcoded caps: `maxRepeatedToolCalls` (default 3), `maxEmptyTurns` (default 2), and `maxMalformedRetries` (default 2). The same limits now protect the `--plain` runtime used by `nanocoder run` in CI and non-TTY environments, which previously had no repeated-call cap at all. Calls to unknown tools count toward the repeated-call streak in both runtimes, so a model stuck on a nonexistent tool trips the same cap instead of looping until the turn ceiling.

Automatic session titles keep the opening prompt as the title by default, and generate a descriptive name once when the opening prompt is too thin to be useful. Manual renames are never overwritten. Titling applies to the ACP agent (and therefore the VS Code extension). Set `sessions.smartTitles: false` to turn it off.

Other improvements: `nanocoder config list|show|diff` to see your settings and which file set each one; `.nanocoderignore` for keeping tracked-but-noisy files (lockfiles, generated fixtures) out of context even when `.gitignore` does not cover them; a published JSON Schema for `agents.config.json`; a Cheaper Inference provider template in the settings wizard; a `showAgentBashOutput` preference for command output on agent cards; JSON exports via `/export --json`; and grouped, collapsible work summaries in the VS Code chat panel.

Notable fixes: `string_replace` and `diff_edit` no longer corrupt edits whose replacement contains `$` (Makefiles, shell scripts, regex templates are ordinary characters again, closes #1057). Write tools now refuse `.pdf` and `.docx` paths outright instead of silently replacing the document bytes with a markdown transcript (closes #1058). The VS Code companion WebSocket now requires a bearer token, so other local processes and browser tabs can no longer drive a running session. Parallel subagents no longer hang on the first approval prompt (closes #1156). `--context-max` rejects malformed values. Custom command arguments now pass through verbatim instead of through a shell tokenizer. Prompt scrubbing now applies to `--plain`, ACP, subagents, and compaction. `nanocoder run` exits 1 on failure so CI can tell a failed run from a finished one.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.
