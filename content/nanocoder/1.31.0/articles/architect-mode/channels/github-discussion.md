---
product: nanocoder
version: "1.31.0"
channel: github-discussion
title: "Architect mode in v1.31: review the turn, not the edit"
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 12060
---

Per-tool approval is a holdover from when the model wrote one file at a time. A refactor that touches twelve files now needs twelve approval prompts, each with a diff the operator is being asked to read in order, each blocking the next one until you press a key. The whole prompt cadence is wrong for the work agents actually do, and it pushes an operator into one of two states: rubber-stamp every card and ruin the gate's purpose, or read every diff and ruin their own afternoon. Nanocoder v1.31 adds a third option. Architect mode runs the whole turn uninterrupted, takes one checkpoint at the first file mutation, and asks for a single yes/no at the end with a one-keypress revert that puts files back exactly as they were.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The mode, the underlying checkpoint mechanism, and the review UI are documented at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder) under `docs/v1.31.0/features/development-modes.md`. This article is the angle: why per-edit approval is the wrong unit of review for the model that exists now, what a per-turn checkpoint actually buys you, and where the v1.31 fix-up matters.

## Why "one prompt per file" stopped being the right shape

In normal mode, every file-mutating tool call goes through a confirmation gate. The gate was designed in the era when an agentic step tended to mean one tool call: read a file, edit a file, read another, edit another. The gate was a handshake against one bad edit at a time. It stops being a handshake the moment a turn is more than one edit, because the operator is not reviewing changes, they are supervising a sequence. They are pressing Y to keep up, and they cannot tell whether the third card is a typo to revert or a deliberate follow-on.

Yolo mode is the other end. No prompts, files land, you deal with the result. It is the right mode for a class of work and a bad mode for the one where you most want a checkpoint: a multi-file change whose finished shape you want to judge before you commit.

The middle shape does not exist in most tools. Plan mode in Nanocoder reviews a proposal before work starts, which is one half of the answer; it cannot tell you whether the AI did what it said it was going to do, only what it said it was going to do. Architect mode is the other half. It runs the work and reviews the result, with the option to roll the result back wholesale.

## The shape: one checkpoint per turn, taken at first mutation

Architect mode's checkpoint is taken at the first file mutation of the turn and extends as more files are touched. It is a snapshot of every file the turn is about to modify, captured before any of them is modified. Files that do not exist yet are recorded as such, so a revert later knows that "absent" is the original state and deletes the new file rather than leaving it on disk.

One checkpoint, not one per tool call. That distinction is the whole point. The granularity below it is the AI editing itself: it reads back what it wrote, notices its own typos, fixes them, and moves on, all without re-entering the gate. The granularity above it is the whole turn: no per-edit prompts, no per-file prompts, no incremental approvals for an incremental workflow that wants to be judged at the end.

The model gets the same feedback it would have got per-edit in a slower mode. The difference is that the operator is not the bottleneck for that feedback loop.

## The review UI, in three keys

When the turn completes, a review bar shows up with the files it touched and the files it created. Three options, plus Escape:

- **Keep** leaves everything and releases the checkpoint.
- **Revert** restores every changed file and deletes every file the turn created.
- **Revert & Revise** reverts and starts the next turn with the instructions you type.
- **Escape** is Keep. It is the reflex key for "get me out of this prompt", so it resolves to the non-destructive branch. Reverting on Escape would discard a whole turn's work on a keypress people tend to make without reading; v1.31 fixes a defect where Escape reverted silently, which was the wrong default.

Reverting also tells the AI what happened, in the next turn's context, so it does not try to edit against files that no longer exist. That detail matters: an agent that has lost track of disk is dangerous in a way that is not always obvious from the prompt alone.

The "Revert & Revise" path used to send a fixed string instead of the instructions you typed. v1.31 fixes that, and also fixes a class of defects where keystrokes could leak to the underlying composer while the review bar was open and bypass the gate; the composer is hidden while the bar is up, so a keypress goes to one component only.

## What Architect does *not* waive

A checkpoint only covers side effects it can undo. Tools with side effects a checkpoint cannot reach still prompt exactly as they do in normal mode:

- **Still prompts:** `execute_bash`, `git_pr` when it creates a pull request, MCP tools (unless listed in the server's `alwaysAllow`), and custom tools declared `approval: always`.
- **Waived:** `write_file`, `string_replace`, `diff_edit`, `file_op`, `lsp_format_document`, and any custom tool that mutates files.

Architect also removes the tools that commit work past the review gate: `git_commit`, `git_pr`, and `write_plan`. Committing sits on the far side of a checkpoint whose whole purpose is that you might revert, and a `git_commit` is the kind of side effect that turns a "Revert" into a much larger cleanup.

The practical reading: Architect waives per-call approval for the tools whose effects can be put back on disk, and keeps approval for everything else. Bash still asks. PR creation still asks. MCP tools still ask. The gate moves from "every file edit" to "every external side effect", which is the line a checkpoint can actually draw.

A second effect follows: gating a turn twice would make Architect worse than normal mode, so the batching only pays off if the turn runs uninterrupted. That is why the mode is paired with the exclusion of the side-effect tools rather than just the waiving of the file tools; the boundary is one decision, not two.

## What the checkpoint actually is

The checkpoint mechanism Architect mode uses is the same `/checkpoint` mechanism a session already has, just created and released automatically. Each turn's checkpoint is deleted once the review bar resolves, so a session in Architect mode does not accumulate an unbounded list under `/checkpoint list`.

The v1.31 fix-up matters here. Six defects in the original gate, all in the review-bar boundary, are resolved:

- Revert now deletes files the turn created, instead of leaving them on disk.
- Escape keeps rather than silently reverting, and the footer says so.
- Revert & Revise sends the instructions you typed, not a fixed string.
- The composer is hidden while the gate is open, so keystrokes cannot reach two components and the gate cannot be bypassed.
- The checkpoint now covers every file-mutating tool Architect auto-executes, including `lsp_format_document` and custom file tools.
- Each turn's checkpoint is released once the gate resolves, rather than held until a manual cleanup.

If a checkpoint cannot be written (an unwritable directory, a full disk), the turn still runs and a warning is logged. The review bar will not offer revert for that turn, because there is nothing to revert to.

## Plan and Architect are reviewing different things

The Nanocoder modes differ along two axes: whether each tool call is gated, and whether anything reaches disk. The two reviewing modes review different artifacts.

| Mode | Per-tool approval | Reaches disk | Review point |
| --- | --- | --- | --- |
| Normal | Every tool that can change something | Yes | Before each call |
| Auto-accept | Bash, `git_commit`, PR-create, custom `always` | Yes | Before risky calls |
| Yolo | None | Yes | None |
| Plan | N/A, cannot mutate | No | The plan, before any work |
| Architect | Same as auto-accept, plus MCP tools | Yes | The whole turn, after it runs |

`Plan` reviews a proposal before any work happens. `Architect` lets the work happen and reviews the *result*. Each catches what the other cannot. A plan that misses a step will not be caught by Architect, because the work produced will be the executed plan. A finished turn that does not match the plan will not be caught by Plan, because the plan was sound and the implementation diverged. The two together cover both the reasoning path and the final state; neither alone does.

The review point is `before` in Plan and `after` in Architect, and that distinction shows up as something operator-visible. In Plan, you can usually tell whether the plan is right within a minute of reading it. In Architect, you tell whether the work is right by running tests, reading diffs, or exercising the changed code, and those take as long as the change took to make. The gate has to live where the judgement takes place, not where it is fast. Per-call approval moved it too early. Plan kept it before the work. Architect puts it at the end, where the work is finished and the judgement is fastest.

## When to reach for it

Architect is not "better normal mode". It is a different review cadence for a different workload. Three workloads suit it.

A refactor that touches many files. Twelve edits are not twelve decisions; they are one decision made twelve times. Plan mode for the shape, then Architect for the execution; review the diff at the end, revert and revise if the shape is wrong, keep if it is right.

A change whose finished shape is the thing you want to judge. A test stub that compiles but does not test anything. A name change that broke a downstream import. A formatting rule that was applied wrong. The unit of judgement is "is the file right as a whole", and that is what the review bar shows you, with no incremental approval friction.

Anything you would otherwise have to rubber-stamp. The single biggest failure mode of per-edit approval is that operators stop reading the diffs. They press Y. They learn to skim. They catch the typos only after `git add`. Architect takes rubber-stamping off the table by making the prompt cadence match the work, and turns the review bar into the unit of judgement.

There are workloads it is wrong for, and those are the workloads normal mode was correct for. A single destructive command. A change to infrastructure outside the working tree (`git push`, a remote deploy, anything bash can do to the world outside disk). A change you would want to abort *as it is happening*, not when it is done. Architect is a check at the end, not a stop in the middle.

## Where this leaves the modes

The shape v1.31 settles into is five modes with five review points: normal for "approve each step", auto-accept for "approve only the risky steps", yolo for "approve nothing, watch the screen", plan for "approve the plan, not the work", and architect for "approve the work, not the steps". The mode you pick is the rhythm you want, and Architect is the rhythm that matches the way the work actually arrives.

The v1.31 fix-up to the review gate is a useful signal in itself. The mode's first cut shipped with six defects in the same boundary, all of them about what to do when a decision is made at the end of a turn rather than during it. "Revert or keep" sounds like a one-line UI question and turns out to be four or five decisions interleaved: what counts as the original state, what to do with files that did not exist before, what keyboard reflex to honour, what to send to the model on the next turn, what to release when the bar closes. The fixes are not cosmetic; they are the gate being correct.

Full docs and changelog at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder). If anything is broken or surprising, open an issue or drop a note in Discord.
