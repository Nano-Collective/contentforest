---
product: get-md
version: "1.7.0"
channel: linkedin
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 1284
---

A short follow-up to the v1.7.0 announcement, on the part of the release that doesn't usually get its own post.

When a docs site renders Mermaid client-side (GitHub, MkDocs, Docusaurus), the HTML you fetch holds the rendered `<svg>`, not the source. The original fence is gone. get-md now goes looking for it before Readability and the HTML cleaner can strip it, and rewrites the container into a ` ```mermaid ` fence in place.

The recovery tries five strategies, in order:

1. A `<script type="text/mermaid">` tag, inside the container or as a sibling.
2. A `data-code`, `data-mermaid`, `data-src`, `data-original`, or `data-source` attribute.
3. The container's own text, when it is a `<pre>` with no `<svg>` inside.
4. A hidden `pre[hidden]`, `<template>`, or `textarea[hidden]`.
5. The SVG's `<desc>`, `<title>`, or `aria-label`.

The first four are "the source is around somewhere". The fifth is a fallback, and the reason it is guarded so carefully: mermaid.js writes accessibility strings like `Created with Mermaid` into those nodes. A loose guard would emit that literal string as a fenced diagram, which is worse than dropping the diagram. The guard only accepts the candidate when it has a newline or `;`, starts with a known diagram keyword, or starts with a keyword and carries an arrow, a colon, or more than 20 characters. `Created with Mermaid` is rejected. A real `sequenceDiagram Alice->>Bob: hi` is accepted. When none of the three accessibility nodes passes, the SVG is left in place and its text labels fall through as loose text.

The full precedence and the guard logic are in `src/optimizers/mermaid-recovery.ts` and covered one-to-one in `mermaid-recovery.spec.ts`. The deep dive is in the GitHub Discussion.

Repo: https://github.com/Nano-Collective/get-md