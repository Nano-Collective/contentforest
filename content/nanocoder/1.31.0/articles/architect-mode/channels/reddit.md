---
product: nanocoder
version: "1.31.0"
channel: reddit
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 5743
---

We added a new development mode to Nanocoder in v1.31 and we want to walk through why, because the rationale matters more than the feature.

## The problem with per-file approval

Most agent tools gate every file-mutating tool call behind an approval prompt. That made sense when a turn was one tool call: read, edit, done. For today's multi-file work it does not. A refactor that touches twelve files makes twelve approval prompts, each one asking the operator to read a diff in isolation and decide whether to keep the change before the next one runs. The operator is not reviewing the result any more; they are supervising a sequence. They press Y to keep up, and they cannot reliably tell whether the third card is a typo to revert or a deliberate follow-on.

There are two escapes from that, neither great. Yolo mode skips the prompts entirely, which works for low-stakes work and is the wrong mode for anything you would want a checkpoint on. Plan mode reviews a *proposal* before any work happens, which catches the wrong plan but cannot tell you whether the AI did what it said it was going to do.

Architect mode is the third option. It runs the whole turn uninterrupted, takes one checkpoint at the first file mutation, and asks for a single yes/no at the end with a one-keypress revert that puts files back exactly as they were.

## What it actually does

The checkpoint is taken at the first file mutation of the turn. It is a snapshot of every file the turn is about to modify, captured before any of them is modified. Files that did not exist before the turn are recorded as absent, so a revert later knows that "absent" is the original state and deletes the new file rather than leaving it on disk.

One checkpoint covers the whole turn, including files first touched partway through. Tools execute for real, not behind a buffer. The AI reads back what it wrote, notices its own mistakes, fixes them, and you only ever see the finished result.

At the end of the turn a review bar appears with three options:

- **Keep** - leave everything in place, release the checkpoint.
- **Revert** - restore every file to its pre-turn contents and delete files the turn created.
- **Revert & Revise** - revert and start the next turn with the instructions you type.

Escape resolves to Keep. It is the reflex key for "get me out of this prompt", so it has to resolve to the non-destructive branch; reverting on Escape would discard a whole turn's work on a keypress people usually make without reading. v1.31 fixes a defect where Escape reverted silently, and the footer now says what Escape does.

Reverting also tells the model what happened, so its next turn does not edit against files that no longer exist.

## What it does *not* waive

A checkpoint only covers side effects it can undo. Bash, MCP tools, PR creation, and any custom tool marked `approval: always` still prompt exactly as they do in normal mode - they are the things a checkpoint cannot reach (a `git push` is not undone by reverting your working tree). Committing and writing a plan are excluded entirely, because a commit sits on the far side of a gate whose whole purpose is that you might revert.

The file-mutating tools (write_file, string_replace, diff_edit, file_op, lsp_format_document, and any custom file mutator) run without a per-call prompt. That is the actual surface Architect widens.

## Why the v1.31 fix-up matters

Six defects in the review-bar boundary were closed in this release:

- Revert now deletes files the turn created, instead of leaving them on disk.
- Escape keeps rather than silently reverting, and the footer says so.
- Revert & Revise now sends the instructions you typed, not a fixed string.
- The composer is hidden while the gate is open, so keystrokes can no longer reach two components and the gate cannot be bypassed.
- The checkpoint covers every file-mutating tool Architect auto-executes, including lsp_format_document and custom file tools.
- Each turn's checkpoint is released once the gate resolves.

These look like polish items but they are not. "Revert or keep" sounds like a one-line UI question and turns out to be four or five decisions interleaved: what counts as the original state, what to do with files that did not exist before, what keyboard reflex to honour, what to send to the model next, what to release when the bar closes. The fixes are the gate being correct.

## Plan and Architect reviewing different things

Plan mode reviews a *proposal* before any work happens. Architect reviews the *result* after the work. Each catches what the other cannot. A plan that misses a step will not be caught by Architect, because the work produced will be the executed plan. A finished turn that does not match the plan will not be caught by Plan, because the plan was sound and the implementation diverged. The two together cover both the reasoning path and the final state; neither alone does.

## When to use it

A refactor whose finished shape you want to judge as a whole. A change that touched many files where approving each one is noise. Anything you would otherwise have to rubber-stamp.

A single destructive command is still normal mode. A change to anything outside the working tree (a `git push`, a remote deploy, anything bash can do to the world outside your tree) is still normal mode. Architect is a check at the end, not a stop in the middle.

## Try it

`Shift+Tab` cycles through modes in interactive sessions: normal -> auto-accept -> yolo -> plan -> architect. Or boot a session with `--mode architect`. Run mode supports `--mode=architect` too.

Full docs at https://github.com/Nano-Collective/nanocoder. If anything is broken or surprising, please open an issue or drop a note in Discord.
