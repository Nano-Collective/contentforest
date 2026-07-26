---
product: get-md
version: "1.7.0"
channel: reddit
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 4393
---

A short writeup of a corner of get-md 1.7.0 that deserved its own post: the Mermaid recovery precedence. The headline announcement covers it in two paragraphs, but the design choices are interesting enough that I wanted to walk through them properly.

**The problem we were solving**

If you fetch a GitHub README or a MkDocs page and try to convert it to Markdown, the Mermaid diagrams in it vanish. The HTML you get back holds the rendered `<svg>`, not the diagram, because the docs site ran mermaid.js in the browser to produce it. The original fence is gone. A converter that only looks at the SVG has nothing to recover.

The source is usually still in the DOM somewhere. Some renderers inject a `<script type="text/mermaid">` block alongside the rendered SVG. Some stash the source in a hidden `<template>` or a `<textarea>` so it survives into the served HTML for crawlers and screen readers. Some themes put it in a data attribute. And some, as a last resort, only leave an accessibility string on the SVG itself.

get-md 1.7.0 ships a `recoverMermaid` pass that runs before Readability and the HTML cleaner. It walks the document looking for `.mermaid`, `pre.mermaid`, `[data-processed='true']`, `svg[id^='mermaid-']`, and `svg.mermaid` containers, and for each one it tries five strategies in order, taking the first one that returns a non-empty string.

**The five strategies**

1. A `<script type="text/mermaid">` tag, inside the container or as a sibling.
2. A `data-code`, `data-mermaid`, `data-src`, `data-original`, or `data-source` attribute.
3. The container's own text, when it is a `<pre>` with no `<svg>` inside.
4. A hidden `pre[hidden]`, `<template>`, or `textarea[hidden]`.
5. The SVG's `<desc>`, `<title>`, or `aria-label`.

The first four are "the source is around somewhere". The implementation just has to find it. The order is a confidence ladder: script tags and data attributes are explicitly authored, container text is intrinsic, hidden templates are renderer-specific, and accessibility nodes are the worst signal of all.

When any strategy succeeds, the matched container is rewritten into a `<pre><code class="language-mermaid">source</code></pre>` block in place. That's the same shape the preservation path emits for a Mermaid fence that was already in the source, which means the downstream Markdown converter treats both as identical fenced blocks. The recovered fence then flows into the optional `validateMermaid` step exactly like any other Mermaid block.

**Why the last one has a guard**

The fifth strategy is the interesting one, and the one that took the most thought. In a browser, mermaid.js writes accessibility text into the SVG's `<desc>`, `<title>`, and `aria-label`. Sometimes that's a screen-reader announcement ("Created with Mermaid"), sometimes a placeholder, sometimes a real diagram label. The contents are not reliable Mermaid source.

If we just emitted whatever was in those nodes, we'd produce fenced diagrams containing `Created with Mermaid`. Worse than dropping the diagram: a false fence that breaks on the consumer's side, and a confusing experience for whoever has to clean it up. So `isLikelyMermaidSource` checks the candidate before it ever becomes a diagram.

A candidate passes only when one of three conditions holds: it contains a newline or a `;`, it starts with a known diagram keyword (`graph `, `flowchart `, `sequenceDiagram`, `gantt`, `classDiagram`, `stateDiagram`, `pie`, `erDiagram`, `journey`, `gitGraph`, `mindmap`, `timeline`), or it starts with a keyword AND carries an arrow (`-->` or `->`), a colon, or more than 20 characters.

In practice:

- `Created with Mermaid` is rejected: no newline, no `;`, doesn't start with a keyword.
- `sequenceDiagram Alice->>Bob: hi` is accepted: starts with a keyword, contains an arrow and a colon.
- `erDiagram` alone is rejected: has the keyword, but no arrow, no colon, only nine characters.
- `Graph: payments pipeline` is rejected: `Graph` with a capital G isn't in the keyword list.

When `<desc>`, `<title>`, and `aria-label` all fail the guard, the function returns `null` and no fence is emitted. The SVG stays in the DOM and its text labels fall through as loose text, which is the same behaviour 1.6.0 had for diagrams with no recoverable source. The implementation does not try to guess; if it cannot confirm the candidate is real Mermaid source, it leaves the SVG alone.

The guard is checked against `<desc>` first, then `<title>`, then `aria-label`. Each one is independent. A rejected `<desc>` doesn't skip `<title>` or `aria-label`, because some renderers only populate one of the three.

**How this shows up across renderers**

The same precedence handles GitHub, MkDocs, and Docusaurus, because the differences are mostly which strategy wins first.

- GitHub renders README Mermaid blocks into `<div class="mermaid" data-processed="true"><svg>...</svg></div>` with a sibling `<script type="text/mermaid">`. Strategy 1 recovers, via the sibling-script branch.
- MkDocs with the official `mkdocs-material` Mermaid integration renders into a `<pre class="mermaid">` containing an SVG, with the source stashed in a hidden template or textarea for the client-side renderer. Strategies 3 and 4 recover.
- Docusaurus with `@docusaurus/theme-mermaid` renders into a `<div class="mermaid">` containing an SVG, with the source in a hidden template. Strategy 4 recovers.

**Why the strict guard matters**

The accessibility fallback is a real strategy; we have test coverage that confirms it works when a candidate legitimately carries Mermaid source. But the tests also pin the edges: a bare `Created with Mermaid` accessibility string does not survive the guard, the SVG is left in place, and an SVG with no recoverable source at all is left alone with no false fence and no fallback to text labels. The recovery is conservative on purpose. A wrong diagram is worse than a missing one, because a wrong one will parse-check fine until a real consumer runs into it.

If your pages have Mermaid blocks that aren't recovering, the most likely cause is that the theme is using one of the "wrong" containers (a generic `<div>` with no class), or that the source really isn't in the DOM anymore. In either case the SVG falls through as text, and the validator (if you have it on) won't be able to help, because there's no fence to validate. Open an issue with the URL and we'll see whether the recovery needs another strategy.

Repo: https://github.com/Nano-Collective/get-md