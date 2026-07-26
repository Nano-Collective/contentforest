---
product: get-md
version: "1.7.0"
channel: github-discussion
title: "Why Mermaid validation was rejecting valid diagrams - and what fixed it"
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 11763
---

A bug in the v1.6.0 release of `validateMermaid` only showed up once we tried to use the option for what it was built for. The validator was annotating valid output, including correct diagrams the vision path had reconstructed from a PDF, as broken. The root cause was not Mermaid. It was a piece of browser-only code Mermaid ships with: DOMPurify.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## The symptom

`validateMermaid: true` is supposed to flag ` ```mermaid ` fences that don't parse. In practice, with `mermaid` installed, every labelled diagram was being flagged. A `graph TD` with `A[Start]` and `B{Choice}` got a `> [!WARNING]` callout. A `sequenceDiagram` with `Alice->>Bob: Hi` got one. A `classDiagram`, a `stateDiagram`, an `erDiagram`, a `mindmap`, all got one. The error message attached to every callout was the same: `DOMPurify.addHook is not a function`.

The diagrams themselves were fine. Mermaid was rejecting them by accident, and the validator was translating that accident into a syntax error.

That made the option actively harmful. The whole point of the flag is to catch what the PDF vision path, or any other model-assisted path, gets wrong. If the validator annotates a correct vision reconstruction as broken, it is inverting the contract: the trust check itself becomes the source of untrustworthy output.

## Why Mermaid needs a DOM

When you call `mermaid.parse(text)`, the parser walks the diagram and, at some point, runs the label text through a sanitizer. The sanitizer is DOMPurify. DOMPurify does not need the labels for any of that sanitization work; it is doing it because labels in Mermaid diagrams can contain user HTML, and DOMPurify is what guarantees user HTML does not become an XSS vector in a rendered output.

DOMPurify is a browser package. Its contract, going back to its first release, is that it attaches itself to whatever DOM API happens to be on the global scope. In a browser that is `window`, `document`, `Node`, `Element`, `HTMLTemplateElement`, and a handful of others. DOMPurify calls `globalThis.window.document` and friends the first time it runs. If `window` is `undefined`, DOMPurify does not fall back to "no DOM". It throws.

So the contract is: by the time Mermaid imports DOMPurify, the global scope has to look like a browser. Under Node there is no such global. The `mermaid.parse` call path that goes through the label sanitizer walks straight into `DOMPurify.addHook is not a function` and throws.

This is not a Mermaid design choice. It is a reasonable assumption that breaks in any environment without a DOM. JSDOM, happy-dom, jsdom-global, and a hand-rolled polyfill all fix it. The interesting question is how to install one without breaking the host process.

## The fix shape

The validator now does three things, in order, before it ever calls `mermaid.parse`:

1. Check whether a DOM is already installed. If it is, do nothing. A browser, a test suite that set up JSDOM, an earlier validator call: none of them get clobbered.
2. If not, dynamically import `happy-dom-without-node`, construct a `Window`, and copy the DOM globals it exposes onto `globalThis`. The imports happen after the check, so the dependency is only loaded on the validation path, and only when the host needs it.
3. After Mermaid finishes parsing, restore the global scope to exactly what it looked like on entry. Keys that were present are put back. Keys that were not present are removed.

The order matters. DOMPurify binds to the global scope the first time Mermaid imports it. Installing the DOM after the import, or installing it but not before the parser reads the labels, does not help. The install has to complete before `await import("mermaid")` returns.

## The two edge cases the install hides

### Saving and restoring `process`

`new Window({ url: "..." })` from happy-dom writes several properties onto `globalThis` as a side effect of construction. One of them is `process`. The happy-dom `Window` is itself a small browser-shaped object, but its constructor needs to expose a couple of node-style shims for happy-dom's own internals. `process` is one of them.

If you build the Window and then walk away, the rest of your code, anything that calls `process.exit`, anything that reads `process.argv`, anything that does `process.env.X`, is now running against happy-dom's shim instead of Node's real `process`. The shim looks similar; it is not the same. The shim's `process.exit` does not exit. Its `process.env` is empty.

The fix is mechanical. Save the original `process` immediately before construction, then write it back immediately after:

```typescript
const originalProcess = scope.process;
const win = new Window({ url: "https://example.com" });
if (originalProcess !== undefined) scope.process = originalProcess;
```

The window itself can stay on the global scope for the duration of validation; that is what DOMPurify expects. Only `process` needs to be restored eagerly, because losing it breaks the host process mid-import.

A regression test in `mermaid-validator.spec.ts` pins this: after `validateMermaid` returns, `globalThis.process` is the same object it was on entry, and `typeof globalThis.process.exit === "function"`. If a future refactor reorders those two lines and `process` leaks, the test fails.

### Assigning to `navigator`

`happy-dom-without-node` exposes a `Window.navigator`. The validator copies it onto `globalThis` so DOMPurify can read it. On most Node versions that is a normal property assignment. On newer Node versions (the change landed somewhere in the 20.x line) `navigator` is a getter-only property on the global scope, defined by the runtime itself, and writing to it with `scope.navigator = value` throws `TypeError: Cannot set property navigator of #<Object> which has only a getter`.

The install path uses a guarded assignment:

```typescript
const assign = (key: string, value: unknown) => {
  try {
    scope[key] = value;
  } catch {
    Object.defineProperty(scope, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
};
```

`defineProperty` with `configurable: true` rewrites a getter-only property into a plain data property, which is what `assign` actually wants. The catch is for the assignment form, the inner block is for the rewrite. The same helper restores globals on the way out, so a host that ships with its own `navigator` polyfill gets the original back when the validator finishes.

## Distinguishing syntax errors from environmental ones

Even with the DOM installed, two diagram types (`pie` and `gitGraph`) still fail inside validation. They throw inside a parser chunk Mermaid lazy-loads the first time you ask for one of those types, and the lazy loader is not the same code path as the DOM-bound label sanitizer. With the DOM in place, those throws come up as "module not initialized" rather than "DOMPurify is missing", but they are still environmental, and still not the user's fault.

The validator now classifies a throw by its error message before deciding what to do with it:

```typescript
function isSyntaxError(message: string): boolean {
  return /parse error|no diagram type detected|expecting|lexical error|syntax error/i.test(
    message,
  );
}
```

A throw whose message matches the pattern is treated as a real syntax complaint, and the block is annotated with the `> [!WARNING]` callout. A throw whose message does not match is logged once via `console.warn` and the diagram is left alone. The block count warning is module-level so a 50-block document with a single lazy-loaded parser chunk failing only logs once, not 50 times. Two diagram types that hit the lazy-load path (`pie`, `gitGraph`) are documented in the changelog as skipped.

This is the more important half of the fix. Even if the install dance worked perfectly, there is no world in which the validator should report "invalid syntax" for a diagram that Mermaid failed to parse for environmental reasons. Doing so corrupts the output (the author's diagram is correct), and worse, it tells the user the trust check is lying. Saying nothing and continuing is the honest move.

## Idempotency

A separate but related fix: re-running the validator on Markdown it has already annotated used to stack a second warning onto the same block. The fix is a tight regex match against the 150 characters preceding each block, looking for the exact warning text the validator itself inserts. If the warning is already there, the block is left alone.

The fence-matching regex itself was tightened at the same time. The previous version was loose about whitespace around the closing fence, which produced unstable matches across passes and contributed to the stacking. The new regex anchors on `\r?\n` boundaries so identical input produces identical splits across passes.

## Why `happy-dom-without-node`

The dependency choice is deliberate and worth stating. `happy-dom-without-node` is a fork of happy-dom that does not pull `node:os` or any other `node:`-prefixed module at runtime. That makes it usable in three environments with the same import line: plain Node (the standard install), React Native (where `node:os` is undefined), and the browser (where it falls through to whatever is there). The regular `happy-dom` package would have worked for Node and the browser but would have broken React Native, where `validateMermaid` is a real install path.

The library only loads it dynamically, and only on the validation path, only if `validateMermaid: true` is set and a Mermaid fence is present. The default install footprint is unchanged. A user who never turns the option on never touches the dependency.

## What changed for users

Three concrete things, on top of "the validator now does what its name suggests":

- Diagrams with node labels, the most common case, are no longer annotated as invalid. The fix lands for `A[Start]`, `B{Choice}`, `-->|yes|`, and every class, state, ER, gantt, and mindmap diagram that uses them. The change shows up immediately in any document that previously produced a wall of false-positive warnings.
- The validator is now safe to call from a long-running process. It does not leak `window`, `document`, `process`, or any other DOM-shaped global onto the host's scope. A test in `mermaid-validator.spec.ts` asserts the round-trip explicitly.
- Two diagram types remain unsupported: `pie` and `gitGraph`. Both fail inside a parser chunk Mermaid lazy-loads, and the failure is environmental rather than syntactic. The validator logs once and moves on. The diagrams themselves render fine through any other path; the validator is just opting out of claiming it checked them.

## The wider pattern

This is one of two near-identical install-and-restore dances in the codebase. The Markdown parser does the same thing for Readability, which also needs a DOM, in `src/parsers/markdown-parser.ts`. The two implementations diverge in detail (Readability needs the document to live for the duration of a parse, not just the duration of a call), but the discipline is the same: snapshot the global scope on entry, install what you need, restore what you saved, only ever touch globals that were not already present.

The discipline is what makes a Node library that uses DOM packages safe to drop into a long-running service. Any library that copies DOM globals onto `globalThis` and forgets to undo it leaks. Any library that doesn't even check whether a DOM was already there can clobber a host that set one up first. The check, the snapshot, and the restore are three lines that, together, are the difference between "works" and "works in a long-running process too".

Repo: https://github.com/Nano-Collective/get-md