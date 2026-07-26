---
product: get-md
version: "1.7.0"
channel: reddit
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 6027
---

Here's a debugging story from the get-md 1.7.0 release that I think is worth sharing.

In 1.6.0 we shipped `validateMermaid: true`, an opt-in option that runs every ` ```mermaid ` fence in the output through Mermaid's own parser and annotates the ones that fail. The idea was straightforward: if you're using the PDF vision path to reconstruct diagrams, you want to know which ones the model got wrong so you can repair them rather than ship broken Markdown.

The first time someone ran it on a real document, every labelled diagram came back flagged. `graph TD` with `A[Start]`, decision diamonds, labelled edges, sequence diagrams, class diagrams, state diagrams, ER diagrams, mindmaps: all of them annotated as `> [!WARNING]` Invalid Mermaid syntax. The error message attached to every annotation was `DOMPurify.addHook is not a function`.

The diagrams were fine. Mermaid was rejecting them by accident. The validator was translating that accident into a syntax error.

The reason turned out to be a chain of dependencies. Mermaid ships DOMPurify for sanitizing label text. DOMPurify is a browser package and its contract is that it attaches to whatever DOM is on the global scope at import time. Under plain Node there is no DOM, so any label that goes through the sanitizer walks straight into `DOMPurify.addHook is not a function` and throws.

The validator was treating every throw as a syntax error, which is the worst possible behaviour for a trust check. The whole point of the option is to flag genuine mistakes. If it flags correct output, it is inverting the contract.

The fix in 1.7.0 is a headless-DOM install dance:

1. Before importing Mermaid, check whether `globalThis.window` is already defined. If it is, do nothing: a browser, a test suite that set up JSDOM, an earlier validator call. None of them get clobbered.
2. If not, dynamically import `happy-dom-without-node`, construct a `Window`, and copy the DOM globals it exposes onto `globalThis`.
3. Snapshot the global scope first. Restore it exactly on the way out: keys that were present go back, keys that were not present get removed.
4. Only then import Mermaid. Order matters: DOMPurify binds to the global scope the first time Mermaid is imported, so the install has to complete before the import returns.

Two edge cases the install hides that I had not appreciated before writing it:

- `new Window({ url: "..." })` from happy-dom writes `process` onto `globalThis` as a side effect of construction. The happy-dom Window is itself a small browser-shaped object, but its constructor needs to expose a couple of node-style shims for happy-dom's own internals. If you build the Window and walk away, the rest of your code runs against happy-dom's `process` shim instead of Node's real `process`. The shim looks similar; it is not the same. The fix is to save the original `process` immediately before construction and write it back immediately after.
- `navigator` is a getter-only property on the global scope on newer Node versions. Writing to it with `globalThis.navigator = value` throws `TypeError: Cannot set property navigator of #<Object> which has only a getter`. The install path uses a guarded assignment that falls back to `Object.defineProperty` with `configurable: true` to rewrite the getter-only property into a plain data property.

A separate fix is the error classifier. Even with the DOM in place, `pie` and `gitGraph` diagrams still fail inside validation. They throw inside a parser chunk Mermaid lazy-loads the first time you ask for one of those types, and the failure is environmental rather than syntactic. The validator now classifies a throw by its error message before deciding what to do with it. A throw whose message matches the pattern `parse error|no diagram type detected|expecting|lexical error|syntax error` (case-insensitive) is treated as a real syntax complaint, and the block is annotated. A throw whose message does not match is logged once via `console.warn` and the diagram is left alone.

This is the more important half of the fix. Even if the install dance worked perfectly, there is no world in which the validator should report "invalid syntax" for a diagram that Mermaid failed to parse for environmental reasons. Doing so corrupts the output (the author's diagram is correct) and worse, it tells the user the trust check is lying.

A related fix is idempotency: re-running the validator on Markdown it has already annotated used to stack a second warning onto the same block. The fix is a regex match against the 150 characters preceding each block, looking for the exact warning text the validator itself inserts. If the warning is already there, the block is left alone. The fence-matching regex itself was tightened at the same time.

`happy-dom-without-node` (rather than `happy-dom`) was a deliberate choice. The `-without-node` variant does not pull `node:os` or any other `node:`-prefixed module at runtime, which makes it usable in three environments with the same import line: plain Node (the standard install), React Native (where `node:os` is undefined), and the browser (where it falls through to whatever is there). The library only loads it dynamically, and only on the validation path, and only if `validateMermaid: true` is set and a Mermaid fence is present. The default install footprint is unchanged.

The wider pattern is one I had not internalized before this work. Any Node library that uses a DOM-shaped dependency has to follow the discipline: snapshot the global scope on entry, install what you need, restore what you saved, only ever touch globals that were not already present. The check, the snapshot, and the restore are three lines that, together, are the difference between "works" and "works in a long-running process too".

The full breakdown including the install-and-restore code is in the GitHub Discussion linked below. Worth a read if you have ever shipped a Node library that uses a DOM-shaped dependency.

Repo: https://github.com/Nano-Collective/get-md