---
product: nanocoder
version: "1.30.0"
channel: linkedin
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 3250
---

The headline in Nanocoder v1.30.0 is consolidation. Underneath it, a quiet pile of work went into keeping tool results from re-entering model context unbounded. The release notes mention it in one paragraph; we wanted to walk through why each piece exists.

The single primitive is `truncateToolResult` in `source/utils/truncate-tool-result.ts`: a head-and-tail slice with a fixed-length elision marker that carries the original character count. The head gets 40% of the budget, the tail 60%, because for build logs and test output the actionable content (error summaries, failure lists, exit status) lives at the end. The default cap is `MAX_TOOL_RESULT_CHARS = 20_000`. The function is wired into `execute_bash`, custom tools, and the message builder itself, so the loop's invariant is that no single tool result contributes more than 20,000 characters regardless of which tool returned it.

Edit tools got the same treatment. `string_replace` now returns the changed line range plus 20 lines of context on either side, with bracketed line ranges for the omitted regions, instead of the entire modified file. `diff_edit` uses 3 lines of context per block (adjacent windows merged) and a hard 4,000-character cap on the final result. Closes #795.

`git_diff` got `--stat-count=20` on the diffstat path and a 500-line head-and-tail bounded summary for oversized patches. When a multi-file diff is too large to return in full, the tool re-runs the diffstat and returns it with a continuation hint that names the `file` parameter as the next move. File-scoped diffs get the head-and-tail patch directly.

`list_directory` no longer fires `lstat` for every file by default. Each `lstat` was a syscall plus output tokens for a number the model rarely needs from a listing; the size, when it does want one, is `read_file` with `metadata_only=true`, which costs one `lstat` and returns just that file's size.

`write_file` stopped echoing the file body back. The model just authored that exact string as the tool call's arguments; returning it was a second copy of the same content sitting in the message array for every subsequent turn. The new result is a one-line confirmation: line count, character count, estimated token count.

`read_file` on a file over 1,500 lines now returns a 250-line preview with an explicit continuation hint that names the next line and points at `start_line` and `end_line`. The read-before-edit refusal in `string_replace` and `diff_edit` was rewritten to name the threshold: if the file is over 300 lines, specify a range.

The last piece: `toLocaleString()` separators were dropped from model-facing strings in `read_file` metadata, `list_directory` entry counts, and the `@file` mention metadata path. `1,234` and `1234` encode the same number; the comma is wasted in the model-facing string and can drift on a loose parse. Terminal display formatters still get separators because they render for human eyes.

The principle behind all of it: a tool should hand the model exactly what it needs to act next, never the largest payload the underlying primitive happens to produce. The per-result savings compound across the rest of the conversation.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.