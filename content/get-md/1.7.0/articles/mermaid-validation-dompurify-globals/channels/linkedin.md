---
product: get-md
version: "1.7.0"
channel: linkedin
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 1616
---

A bug in `validateMermaid` shipped in get-md v1.6.0 that we finally tracked down in 1.7.0: every labelled diagram was being flagged as broken syntax.

The error message was always the same: `DOMPurify.addHook is not a function`. The diagrams were fine. Mermaid is a browser-shaped package, and the label sanitizer it ships with (DOMPurify) attaches to whatever DOM is on the global scope at import time. Under plain Node there is no DOM, so any diagram carrying node labels (`A[Start]`, `B{Choice}`, `-->|yes|`, sequence, class, state, ER, gantt, mindmap) walked straight into a throw. The validator was treating every throw as a syntax error, which is the worst possible behaviour for a trust check.

The fix in 1.7.0:

- Install a headless DOM (`happy-dom-without-node`) dynamically, *before* importing Mermaid. DOMPurify binds at module load time, so order matters.
- Snapshot the global scope, restore it exactly on the way out. The host process is unchanged.
- Handle two edge cases the install hides: happy-dom replaces `globalThis.process` during `Window` construction, and `navigator` is getter-only on newer Node versions. Both are saved and restored.
- Classify parser throws by error message. Only genuine syntax errors annotate the document. Anything environmental (the `pie` and `gitGraph` parser chunks fail this way) logs once and leaves the diagram alone.

The full breakdown, including the install-and-restore code, lives on the GitHub Discussion linked below. Worth reading if you have ever shipped a Node library that uses a DOM-shaped dependency.

Repo: https://github.com/Nano-Collective/get-md