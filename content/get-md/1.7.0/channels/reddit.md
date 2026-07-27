---
product: get-md
version: "1.7.0"
channel: reddit
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 5619
distributed_at: "2026-07-27T20:38:12.752Z"
---

We've just shipped get-md v1.7.0, and we wanted to explain why this one matters even if you don't use Mermaid.

The short version: 1.6.0 taught get-md to read PDF, DOCX, and Markdown alongside HTML. That worked, but it surfaced a problem we hadn't really focused on before: Mermaid diagrams. They're the thing a Markdown converter usually destroys, because the converter sees either a fence it doesn't recognise or a rendered `<svg>` it doesn't know what to do with. v1.7.0 is about fixing that, end to end.

**What we shipped**

Four diagram behaviours, each independently switchable:

1. **Preserved.** A ` ```mermaid ` fence in your HTML or Markdown comes out the other side unchanged. Same for `dot`, `graphviz`, and `plantuml`, all newly registered as proper language identifiers. Previously these survived only by accident, through a loose lowercase-word fallback with no test coverage behind it.

2. **Recovered.** GitHub, MkDocs, and Docusaurus render Mermaid client-side, so the HTML you fetch holds the rendered `<svg>`, not the diagram. The source is usually still in the DOM somewhere, and we now go looking for it before Readability and the HTML cleaner can strip it. We try `<script type="text/mermaid">` tags, `data-code`/`data-mermaid`/`data-src` attributes, hidden `<template>` and `textarea[hidden]` blocks, and finally the SVG's `<desc>`/`<title>`/`aria-label`. The last fallback is deliberately strict, because mermaid.js writes accessibility strings like `Created with Mermaid` into those nodes, and emitting one as a diagram would be worse than dropping it.

3. **Reconstructed (opt-in).** A diagram in a PDF is vector drawing or raster image. There is no text to recover, so this is a vision problem. With `useLLM` and a remote vision-capable model, we render PDF pages to images and ask the model to emit Mermaid inline where the diagram appeared. Cap is 10 pages, to keep long PDFs from overflowing context. Remote providers only, because the local ReaderLM-v2 path is text-only. Best-effort, not guaranteed fidelity.

4. **Validated (opt-in).** `validateMermaid: true` runs every Mermaid block in the finished Markdown through mermaid's own parser. Invalid blocks are **kept**, with a GitHub-style `> [!WARNING]` callout above them. You repair the diagram rather than losing it. Applies to all Mermaid: preserved, recovered, and model-generated alike.

**Two things that surprised us while building this**

First, Mermaid validation was almost always wrong. `mermaid.parse` sanitizes label text through DOMPurify, which needs a DOM. Under plain Node there wasn't one, so any diagram carrying node labels (`A[Start]`, `B{Choice}`, `-->|yes|`, and every class/state/ER/gantt/mindmap diagram) threw `DOMPurify.addHook is not a function`, and the validator treated every throw as a syntax error. In practice almost every real diagram was annotated as invalid, including correct output from the PDF vision path this option exists to check. We install a headless DOM before importing mermaid now and restore the global scope afterwards, including `process`, which constructing a happy-dom `Window` replaces. Only genuine parse complaints annotate the document now. Two diagram types (`pie`, `gitGraph`) still take the old path, because they fail inside a lazily loaded parser chunk, and they're skipped rather than misreported.

Second, code-block language tags now survive Readability extraction. The Mermaid recovery work sets `keepClasses: true`, so `<pre><code class="language-x">` keeps its class through extraction. This is the most visible change in the release for anyone converting documentation sites: ` ```python `, ` ```go `, ` ```rust ` fenced output is tagged where it previously came out bare. There are two tradeoffs: unrecognised class names can surface as tags via the lowercase-word fallback, and class-based noise rules now match more often (a `cookie-notice` block is correctly dropped, but so is genuine prose carrying an `advertisement` or `popup` class). Worth knowing if your pages lean on either.

**Other fixes**

- `--config <path>` was being silently ignored. The flag was accepted, `--show-config` even printed the path, but every conversion still loaded through cwd/home auto-discovery, so a typo'd config failed silently. All five conversion paths now resolve config through one helper that honors the flag.
- Re-running validation over already-annotated Markdown no longer stacks a second warning onto the same block.
- PDF rendering is loaded dynamically, so the optional `pdfjs-dist` and `@napi-rs/canvas` dependencies are never touched unless vision reconstruction is actually in play.

**Install footprint**

The default install is unchanged. The PDF vision path needs optional `pdfjs-dist` and `@napi-rs/canvas`; the Mermaid validator needs optional `mermaid`. Standard HTML/PDF/DOCX/Markdown conversions work with no peer dependencies.

```bash
npm install @nanocollective/get-md@1.7.0
```

634 tests passing, up from 592 at 1.6.0. New coverage spans every container shape and source strategy for recovery (including the accessibility-text guard), PDF page rendering and the 10-page cap, vision prompting and multimodal message assembly, validation across nine previously false-positived shapes, and the `--validate-mermaid` and `--config` flags end-to-end through the CLI.

The full release post (with the support matrix and recovery precedence order spelled out) is in the GitHub Discussion linked from the repo. Issues and Discord both open if you hit anything or want to dig into the diagram recovery work.

Repo: https://github.com/Nano-Collective/get-md
