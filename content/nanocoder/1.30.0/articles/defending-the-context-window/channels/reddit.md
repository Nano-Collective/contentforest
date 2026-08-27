---
product: nanocoder
version: "1.30.0"
channel: reddit
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 9102
---

Most of the v1.30 release notes are about consolidation (the `/settings` menu, the JSON editor, the VS Code chips), but the thing I want to talk about is what we did with tool results. Every tool call has always had a result; what changed in 1.30 is what that result looks like when it lands back in the model's context.

## The principle

A tool call is paid for twice. The model spends tokens on the result on the way in, and the runtime spends tokens re-rendering it every subsequent turn until the conversation compacts. The first cost is paid once and bounded by the result's size. The second is paid `k` times, where `k` is the number of turns left before a compact. A 5,000-line bash transcript is cheap on turn N and ruinous by turn N+5.

The 1.30 work is, broadly, about reducing the second cost without hurting the first. The model needs enough output to act on the next step. It does not need the rest. The work is making sure the rest stays out of context.

## Tail-weighted bash output

`execute_bash` used to keep the head of long output and discard the tail. The tail is where the actual content lives: the `error:` lines, the failing-test summary, the exit status. The change was to a single primitive in `source/utils/truncate-tool-result.ts`. Head gets 40% of the budget, tail gets 60%. The elision marker carries the original character count so the model knows how much was cut and can decide whether to call the same tool with a narrower argument to see more.

The default cap is `MAX_TOOL_RESULT_CHARS = 20_000`. The function is wired into `execute_bash`, custom tools, and the message builder itself, so the conversation loop's invariant is that no single tool result contributes more than 20,000 characters regardless of which tool returned it. The bash executor still has its own 5 MB memory-protection cap upstream (different concern; one stops allocation, the other stops context bloat). They sit in series.

## Edit results bounded around the change

Before 1.30, `string_replace` returned the entire modified file. For a 2,000-line `package-lock.json` with a one-line `version` change, the model received 2,000 lines back. The new shape returns the changed line range plus 20 lines of context on either side, with bracketed line ranges for the omitted regions. The model gets the change region and a navigable map of what it hasn't seen. If it wants lines 200 to 240, the response tells it the file has at least that many lines and exactly which lines it has and hasn't seen.

`diff_edit` uses 3 lines of context per block (with adjacent windows merged) and a hard 4,000-character cap on the final result. Twenty overlapping blocks across a long file still produce a bounded response. Closes #795.

## `git_diff`: 20-entry diffstat

Three changes worth walking through. First, the explicit diffstat cap: `--stat-count=20` is now passed to `git diff --stat`. When a multi-file diff has more than twenty files, the diffstat lists the top twenty by insertion count, followed by an aggregate line. The model still gets the total file count.

Second, the bounded line summary. `MAX_DIFF_LINES = 500`, and `truncateDiff` in `source/tools/git/utils.ts` keeps the head and the tail when the full diff is over the cap. The diff case is a 50/50 split, unlike the 40/60 split on the general tool-result truncator. The reason is that a diff is structured: the head carries the `diff --git` headers, the tail carries the last hunk's body. Each half needs the budget to keep its structure intact.

Third, the continuation hint. When a multi-file diff is too large, the tool re-runs `git diff --stat-count=20 --stat` and returns the diffstat followed by a "Diff is too large to return in full" notice that points at the `file` parameter as the way to get the detailed output for a specific path. The model gets the file count, the top twenty files' changes, the total line count, and a path to drill in.

## `list_directory` drops sizes by default

`lstat` is a syscall. A recursive walk of a large monorepo used to pay `lstat` for every file. On a 5,000-file directory tree, that's 5,000 syscalls before the tool returns. The output tokens were a separate cost: every entry was rendered with `(12345 bytes)` after it. The model rarely uses directory listings to know how big a file is; it uses them to know what's there.

The change is a `showSizes` argument that defaults to `false`. The `lstat` is now gated behind `if (type === 'file' && showSizes)`. To get sizes back, pass `showSizes=true`. To get the size of a single file, use `read_file` with `metadata_only=true`.

## `write_file` stops echoing content

The write tool used to return the full file body in the result string, with line numbers. That was already bounded to a single file's contents, so it didn't risk the conversation budget on a per-result basis, but it was pure duplication: the model just authored that exact string as the tool call's arguments. Re-rendering it back was a second copy of the same content, indexed by line number, sitting in the message array for every subsequent turn to scan over.

The change is one block in `source/tools/file-ops/write-file.tsx`. The content is read back to verify the write succeeded. The verification result is not echoed. The new result is a one-line confirmation: line count, character count, estimated token count.

The cost saving is per-write but it compounds. A session that writes ten files in a turn used to carry ten full file bodies in the message array. It now carries ten one-line summaries.

## `read_file` returns a preview

Two related changes. First, the new default behavior for files over 1,500 lines: return a 250-line preview of the top of the file, with an explicit continuation hint that names the next line and points at `start_line` and `end_line`.

Before 1.30, `read_file` without `start_line` and `end_line` on a very large file returned either the whole file or refused with an error. The new default returns the preview with a path forward. The model can act on the preview or chain a ranged read. It cannot accidentally load a 50,000-line file into context because it asked for "the file".

Second, the read-before-edit refusal in `string_replace` and `diff_edit` was sharpened. The new message names the 300-line threshold: if the file is over 300 lines, specify a range. The threshold is a model-side heuristic; the validator doesn't read the file to compute it. It's there so the model's next move is unambiguous. The error is a recipe, not a complaint.

## Dropping `toLocaleString` separators

Several tools used to format numbers with `toLocaleString()`, which inserts locale-specific thousands separators. In the user-facing terminal display, those separators are helpful; in the model-facing string, they are wasted tokens. `1,234` and `1234` encode the same number; the comma takes a character and conveys nothing to the model. Worse, the model's interpretation of the formatted number can drift if it parses loosely (`1,234` could be one thousand two hundred thirty-four, or one-point-two-three-four). Stripping the separators is a defensive simplification.

The cleanup walked through `read_file` (`metadata_only` output, line counts, estimated tokens), `list_directory` (entry token counts), and the `@file` mention metadata path used by the VS Code extension's autocomplete. The remaining `toLocaleString()` calls in the codebase are in React formatters that paint the terminal UI. Those still get separators because they render for human eyes.

## How it composes

A representative turn on a small model: the model issues `pnpm test`, gets the result tail-weighted (failure summary at the end intact), then issues `read_file` on the failing test file. If the file is over 1,500 lines, it gets a 250-line preview and a continuation hint; it issues a ranged read on the relevant region. It edits with `string_replace` and gets a confirmation plus twenty lines of context on either side, not the whole file. It calls `list_directory` to find a sibling file, and the listing is small because no sizes are computed. It calls `git_diff` to check what it changed, and either gets a focused patch or a 20-entry diffstat that points at the right file. It writes a follow-up file, and the message array carries a one-line confirmation, not a duplicated body.

Every one of those savings is per-result, but the conversation sees every result across every remaining turn. The per-result budget compounds. The diffstat point is especially load-bearing: the top-twenty summary is the only place the model ever sees all twenty-something files at once, and the bounded continuation hint lets it drill in without re-asking about every file.

The work is small per file. Together, it's the difference between a tool that returns "what the implementation happened to produce" and one that returns "what the model needs to know to act next".

Source and docs at https://github.com/Nano-Collective/nanocoder. If a tool result is too big or too small in a way that matters to your workflow, an issue or a Discord note is the fastest way to reach us.