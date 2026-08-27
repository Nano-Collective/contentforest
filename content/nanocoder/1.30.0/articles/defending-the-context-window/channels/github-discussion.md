---
product: nanocoder
version: "1.30.0"
channel: github-discussion
title: "Defending the context window in Nanocoder 1.30"
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 17458
---

The headline in v1.30.0 is consolidation. Underneath it, though, a quiet pile of work went into keeping tool results from re-entering model context unbounded. The release notes mention the changes in one paragraph; this article is about why each piece exists, where it lives in the source, and how they compose. The principle behind all of it: a tool should hand the model exactly what it needs to act next, never the largest payload the underlying primitive happens to produce.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source: [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## The principle

A tool call is paid for twice. The model spends tokens on the result on the way in, and the runtime spends tokens re-rendering it every subsequent turn until the conversation compacts. The two costs are not the same shape. The first cost is paid once and bounded by the result's size. The second is paid `k` times, where `k` is the number of turns left before a compact. A 5,000-line bash transcript is cheap on turn N and ruinous by turn N+5.

The 1.30 work is, broadly, about reducing the second cost without hurting the first. The model needs enough output to act on the next step: the actionable tail of a build log, the change region of an edit, the diffstat of a multi-file diff, the path and type of a directory entry. It does not need the rest. The work is making sure the rest stays out of context.

## Tail-weighted truncation, the general primitive

The single piece of code behind most of this is `truncateToolResult` in `source/utils/truncate-tool-result.ts`. The function takes a string and a `maxLength`, and returns either the original string (if it fits) or a head-and-tail slice with an elision marker in between. The marker is fixed-length, which matters: it lets the budget arithmetic stay simple regardless of the original content.

```ts
const HEAD_SHARE = 0.4;

export function truncateToolResult(
  content: string,
  maxLength = MAX_TOOL_RESULT_CHARS,
): string {
  if (content.length <= maxLength) return content;
  if (maxLength <= 0) return '';

  const marker = `\n... [Output truncated: ${content.length} characters total; ...] ...\n`;
  const contentBudget = maxLength - marker.length;
  const headLength = Math.floor(contentBudget * HEAD_SHARE);
  const tailLength = contentBudget - headLength;

  return content.slice(0, headLength) + marker + content.slice(-tailLength);
}
```

Two choices are worth calling out.

First, `HEAD_SHARE = 0.4`. The head is 40% of the budget, the tail is 60%. The asymmetry is intentional. For build logs, test output, compiler errors, and command stdout, the actionable content is at the end: error summaries, failing-test names, exit status, last stack frame. A 50/50 split would steal budget from the part the model actually needs. A 40/60 split keeps the head long enough to include command preamble and gives the tail the room to keep the last hundred or so lines intact.

Second, the marker carries the original length. That number is information, not decoration. A model that sees "Output truncated: 8,213 characters total" knows exactly how much content was elided and can decide whether to call the same tool with a narrower argument (a file path, a line range, a grep pattern) to see more. The marker is a signpost with a number on it.

The constant driving this is `MAX_TOOL_RESULT_CHARS = 20_000` from `source/constants.ts`. Twenty thousand characters is roughly four to five thousand tokens, depending on the provider: large enough for almost any single tool call to convey its full meaning, small enough that one or two such results in a turn don't dominate the remaining budget.

This primitive is wired into three call sites.

`source/tools/execute-bash.tsx` pipes the combined stdout/stderr through `truncateToolResult(fullOutput, TRUNCATION_OUTPUT_LIMIT)`. Before 1.30, the bash executor kept only the head; the tail (where `error:` lines, the failure summary from `cargo test`, the pytest report, the npm error block, and the exit status live) was discarded.

`source/custom-tools/handler.ts` runs the same primitive on custom-tool output. Custom tools can return megabyte-scale strings if the underlying action does so. Treating them the same as bash keeps the contract uniform.

`source/utils/message-builder.ts` calls `truncateToolResult` on every tool result before it is appended to the message array, with `MAX_TOOL_RESULT_CHARS` as the default. This is the belt-and-braces case. Tools are encouraged to bound their own output, but even a tool that forgets is bounded before the result reaches the conversation. The loop's invariant is then: no single tool result contributes more than `MAX_TOOL_RESULT_CHARS` characters, regardless of the underlying implementation. The cap is enforced at the boundary.

The bash execution path itself still has its own internal cap. `source/services/bash-executor.ts` watches byte counts against `BASH_MAX_OUTPUT_BYTES = 5 * 1024 * 1024` and appends a memory-exhaustion marker once that threshold is hit. That's a memory-protection cap, not a context-protection cap. Without it, a runaway `cat` against a multi-gigabyte log would allocate the full output before the truncation in `execute-bash.tsx` could shave it down. The two caps compose: bash stops allocating past 5 MB, then the result is tail-weighted into the context budget.

## Edit results bounded around the change region

The next group of changes is about edit tools. The model needs to see enough of the file around an edit to confirm the change landed where it intended; it does not need to see every line of the file, and it certainly does not need to see the file re-emitted when the model just authored the content.

`source/tools/file-ops/string-replace.tsx`. The constant is `STRING_REPLACE_CONTEXT_LINES = 20`. After a successful replace, the result includes the changed line range plus twenty lines of context on either side, with bracketed line ranges for the omitted regions. If the model wants lines 200 to 240 of a file after a `string_replace`, the response tells it the file has at least that many lines and exactly which lines it has and hasn't seen. The model can issue a ranged read to fill the gap; it does not get the whole file dumped on it.

The previous shape, per the changelog, was the entire modified file. For a 2,000-line `package-lock.json` with a one-line `version` bump, the model received 2,000 lines back. Twenty thousand characters of tool result, on every successful edit. The bounded shape drops that to roughly forty lines (twenty on either side), with line numbers and omission markers the model can navigate by.

`source/tools/file-ops/diff-edit.tsx`. Two pieces here. The per-block context window is `DIFF_EDIT_CONTEXT_LINES = 3`: each block's output window is the changed range plus three lines on either side. Adjacent windows are merged (if a later block's window starts before an earlier block's window ends, the two are combined into one), so the model doesn't see overlapping context ranges for blocks that are close together.

Second, a hard character cap on the final result: `MAX_DIFF_EDIT_RESULT_CHARS = 4000`. Four thousand characters covers the change-region context for any reasonable block count. If a model authored twenty overlapping blocks across a long file, the result string still does not exceed 4,000 characters. The marker tells the model the original length and points at `read_file` with a narrow range as the next move. Closes #795.

## `git_diff`: 20-entry diffstat and bounded summaries

`source/tools/git/git-diff.tsx` had three changes. The first is the explicit diffstat cap: `--stat-count=20` is now passed to `git diff --stat`. When a multi-file diff has more than twenty files, the diffstat lists the top twenty by insertion count, followed by an aggregate line. The model still gets the total file count; it just doesn't get every individual line of every individual file in the diffstat block.

The second change is the bounded line summary. `MAX_DIFF_LINES = 500`, and `truncateDiff` in `source/tools/git/utils.ts` keeps the head and the tail when the full diff is over the cap. The diff case is a 50/50 split (head half, tail half), unlike the 40/60 split on the general tool-result truncator. The reason is that a diff is structured: it starts with `diff --git` headers, then `@@` hunks, then content. The head carries the files-changed summary; the tail carries the last hunk's body. A 50/50 split gives each half the budget it needs.

When a multi-file diff is too large, the tool re-runs `git diff --stat-count=20 --stat` and returns the diffstat followed by a "Diff is too large to return in full" notice that points at the `file` parameter as the way to get the detailed output for a specific path. The model gets the file count, the top twenty files' changes, the total line count, and a path to drill in.

File-scoped diffs (`git_diff` with a `file` argument) skip the diffstat summary path entirely; they get the head-and-tail patch instead. The reasoning is the same as for `string_replace`: a single file's diff, with the file argument already provided, is the smallest useful unit of detail.

## `list_directory` drops sizes by default

`source/tools/list-directory.tsx` made one small change with a meaningful cost saving. The `lstat` call that used to fire for every file in a listing is now gated behind an opt-in:

```ts
const showSizes = args.showSizes ?? false;

let size: number | undefined;
if (type === 'file' && showSizes) {
  try {
    const stats = await lstat(fullPath);
    size = stats.size;
  } catch {
    size = undefined;
  }
}
```

The reasoning is straightforward. `lstat` is a syscall. `list_directory` on a recursive walk of a large monorepo used to pay `lstat` for every file. On a 5,000-file directory tree, that's 5,000 syscalls before the tool returns.

The output tokens were a separate cost. Every entry was rendered with `(12345 bytes)` after it. The model rarely uses directory listings to know how big a file is; it uses them to know what's there. The size, when the model wants it, is `read_file` with `metadata_only=true`. That call costs one `lstat` and returns the size in a few hundred characters, only for the file in question.

The flag is `showSizes=true`. The default flipped; the explicit opt-in is now the way to get sizes back.

## `write_file` stops echoing content back

The write tool used to return the full file body in the result string, with line numbers. That was already bounded to a single file's contents, so it didn't risk the conversation budget on a per-result basis, but it was pure duplication: the model just authored that exact string as the tool call's arguments. Re-rendering it back was a second copy of the same content, indexed by line number, sitting in the message array for every subsequent turn to scan over.

The 1.30 change is the result string in `executeWriteFile`:

```ts
const actualContent = await readFile(absPath, 'utf-8');
const lineCount = actualContent.split('\n').length;
const charCount = actualContent.length;
const estimatedTokens = calculateTokens(actualContent);

const action = fileExists ? 'overwritten' : 'written';
return `File ${action} successfully (${lineCount} lines, ${charCount} characters, ~${estimatedTokens} tokens).`;
```

The content is read back to verify the write succeeded; the verification result is not echoed. The model's next decision doesn't depend on re-reading the file body. The bounded summary is enough.

The cost saving is per-write, but it compounds. A session that writes ten files in a turn used to carry ten full file bodies in the message array. It now carries ten one-line summaries.

## `read_file` returns a preview before demanding a ranged read

`source/tools/read-file.tsx` made two related changes. The first is the new default behavior for files over a threshold; the second is the explicit message the read-before-edit refusal returns.

The constants live in `source/constants.ts`:

```ts
export const FILE_READ_PREVIEW_THRESHOLD_LINES = 1500;
export const FILE_READ_PREVIEW_LINES = 250;
```

The behavior in `executeReadFile`:

```ts
if (
  args.start_line === undefined &&
  args.end_line === undefined &&
  totalLines > FILE_READ_PREVIEW_THRESHOLD_LINES
) {
  const previewEndLine = Math.min(FILE_READ_PREVIEW_LINES, totalLines);
  const preview = lines.slice(0, previewEndLine).join('\n');
  markFileSeen(absPath);

  return `${preview}\n\n[Truncated at line ${previewEndLine} of ${totalLines}. Use read_file with start_line: ${previewEndLine + 1} and end_line to continue.]`;
}
```

Before 1.30, `read_file` without `start_line` and `end_line` on a very large file returned either the whole file or refused with an error. The new default returns a 250-line preview with an explicit continuation hint that names the next line and points at the line-range arguments. The model can act on the preview (most edits live near the top of a file) or chain a ranged read. It cannot accidentally load a 50,000-line file into context because it asked for "the file".

The read-before-edit refusal, in the validators for `string_replace` and `diff_edit`, was sharpened at the same time. The new message names the threshold:

```
You must read "${path}" before editing it. Call read_file on it first - if the file is over 300 lines, specify start_line and end_line to read its actual content, not just metadata - then retry string_replace with old_str copied exactly from the file.
```

The 300-line threshold is a model-side heuristic; the validator doesn't read the file to compute it. It's there so the model's next move is unambiguous: call `read_file`, and if it's a long one, specify a range. The error is a recipe, not a complaint.

`markFileSeen(absPath)` is called for preview reads, not just ranged reads. The model has now seen real content from the file (even if only 250 lines of it), so a follow-up edit with content drawn from the preview is not blind. The read-before-edit guard is aligned with what was returned, not with what was requested.

## Dropping `toLocaleString` separators from model-facing strings

The last change is small but pervasive. Several tools used to format numbers with `toLocaleString()`, which inserts locale-specific thousands separators:

```
Estimated Tokens: ~1,234
Lines: 12,345
Tokens: ~123,456
```

In the user-facing terminal display, those separators are helpful; in the model-facing string, they are wasted tokens. `1,234` and `1234` encode the same number; the comma takes a character and conveys nothing to the model. Worse, the model's interpretation of the formatted number can drift if it parses loosely (`1,234` could be one thousand two hundred thirty-four, or one-point-two-three-four). Stripping the separators is a defensive simplification.

The cleanup walks through the model-facing strings in `read_file` (`metadata_only` output, line counts, estimated tokens), `list_directory` (entry token counts), and the `@file` mention metadata path used by the VS Code extension's autocomplete. The remaining `toLocaleString()` calls in the codebase are in React formatters that paint the terminal UI. Those still get separators because they render for human eyes.

## How the pieces compose

A representative turn on a small model: the model issues `pnpm test`, gets the result through `execute_bash` tail-weighted (failure summary at the end intact), then issues `read_file` on the failing test file. If the file is over 1,500 lines, it gets a 250-line preview and a continuation hint; it issues a ranged read on the relevant region. It edits with `string_replace` and gets a confirmation plus twenty lines of context on either side of the edit, not the whole file. It calls `list_directory` to find a sibling file, and the listing is small because no sizes are computed. It calls `git_diff` to check what it changed, and either gets a focused patch or a 20-entry diffstat that points at the right file. It writes a follow-up file, and the message array carries a one-line confirmation, not a duplicated body.

Every one of those savings is per-result, but the conversation sees every result across every remaining turn. The per-result budget compounds. The diffstat point is especially load-bearing: the top-twenty summary is the only place the model ever sees all twenty-something files at once, and the bounded continuation hint lets it drill in without re-asking about every file.

The work is small per file. Together, it's the difference between a tool that returns "what the implementation happened to produce" and one that returns "what the model needs to know to act next".

If something in here regresses, the tool result an affected model sees is too small (missing the actionable tail) or too large (the bounded shape broke). Both are visible to anyone running a long session with tool auto-approval off: a missing-tail truncation shows up as the model asking for the same tool again with a narrower argument; a broken-bound shows up as the conversation budget dying on a single tool call.

Source and docs: [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder). If a tool result is too big or too small in a way that matters to a workflow, an issue or a Discord note is the fastest way to reach the team.