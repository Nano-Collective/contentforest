---
product: nanocoder
version: "1.31.0"
channel: linkedin
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 2685
---

Nanocoder v1.31 introduces Architect mode, a fifth development mode that reviews a whole turn's changes as a unit, with a one-keypress undo, instead of approving edits one at a time.

Per-file approval makes sense for a single edit, and less sense for the multi-file refactor an agent actually performs. Twelve file changes today means twelve approval prompts, each blocking the next one, each asking for a sequential judgement the operator cannot really make in isolation. Operators learn to skim and rubber-stamp, which makes the gate useless.

Architect mode runs the turn uninterrupted. It takes one checkpoint at the first file mutation of the turn, lets the model write, read itself back, fix its own mistakes, and only at the end shows a review bar with three options: Keep (release the checkpoint), Revert (restore every file to its pre-turn contents and delete files the turn created), or Revert & Revise (revert and start the next turn with instructions you type). Escape resolves to Keep, deliberately, because reverting on the reflex key would discard a whole turn on a keypress most people make without reading.

The gate does not waive side effects a checkpoint cannot undo. Bash, MCP tools, PR creation, and custom tools marked `approval: always` still prompt exactly as in normal mode. Committing and writing a plan are excluded entirely. The actual surface Architect widens is the file-mutating tools: write_file, string_replace, diff_edit, file_op, lsp_format_document, and any custom file mutator.

Plan mode reviews a *proposal* before work starts; Architect reviews the *result* after work runs. Both are reviewing modes; they catch different things. A miss in the plan is invisible to Architect (the work matches the executed plan), and a divergence from the plan is invisible to Plan (the plan was sound and the implementation wandered).

The v1.31 release also fixes six defects in the original review bar: Revert now deletes files the turn created, Escape keeps and the footer says so, Revert & Revise sends the instructions you typed rather than a fixed string, the composer is hidden while the gate is open so keystrokes cannot reach two components, the checkpoint covers every file-mutating tool architect auto-executes (including lsp_format_document and custom file tools), and each turn's checkpoint is released once the gate resolves. Reverting now also tells the model what happened, so the next turn does not edit against files that no longer exist.

Switch with Shift+Tab in interactive sessions (cycles normal -> auto-accept -> yolo -> plan -> architect), or boot with `--mode architect`.

Full docs at https://github.com/Nano-Collective/nanocoder.
