---
product: get-md
version: "1.7.0"
channel: github-discussion
title: "How get-md turns rendered Mermaid SVGs back into source"
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 11932
---

If you have ever fetched a GitHub README or a MkDocs page and tried to convert it to Markdown, you have probably watched every Mermaid diagram turn into a black box. The served HTML holds the rendered `<svg>`, not the diagram, because the docs site ran mermaid.js in your browser to produce it. The original fence is gone, the source is somewhere else in the DOM, and a converter that only looks at the SVG has nothing to recover.

get-md 1.7.0 ships a `recoverMermaid` pass that goes looking for that source before Readability and the HTML cleaner can strip it. This post walks through the five-strategy recovery precedence, why the strategies are ordered the way they are, and the strict guard around the last one, the SVG's accessibility text, that makes the difference between useful recovery and emitting a literal "Created with Mermaid" string as a diagram.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## Where this runs

`recoverMermaid` lives in `src/optimizers/mermaid-recovery.ts` and is called from the HTML and URL conversion paths before the Readability-based extraction. Doing it before extraction matters: once Readability scores the rendered `<svg>` as low-signal and discards it, the rest of the page never sees the diagram. Recovering in place, by rewriting the matched container into a `<pre><code class="language-mermaid">` block, lets the downstream pass treat the diagram like any other fenced code block.

Markdown input skips the step. A Markdown file already carries the fence if it carries one at all, and the ` ```mermaid ` preservation path covers that. PDF and DOCX are also unaffected: a PDF diagram is raster or vector drawing, not DOM, and that case is the opt-in vision reconstruction path covered in the headline post.

## What counts as a Mermaid container

The first question is: which nodes are even worth inspecting? Five selectors, in this order:

- `.mermaid`
- `pre.mermaid`
- `[data-processed='true']`
- `svg[id^='mermaid-']`
- `svg.mermaid`

The first three match the wrapper elements Mermaid's own runtime leaves behind. `.mermaid` and `pre.mermaid` are the unmodified wrappers some integrations still emit. `[data-processed='true']` is the marker mermaid.js sets after a successful client-side render, which is what you find on a GitHub-rendered README. The last two match the SVG itself when its id or class still carries the `mermaid-` prefix, which is common in Docusaurus themes.

When the selector picks an `<svg>`, the implementation walks one step up and uses the parent instead, provided the parent is a `<div>`, `<pre>`, or `<figure>`. Doing the work at the wrapper level means later strategies like "look inside the container for a hidden `<template>`" find what they are looking for. Otherwise the search would be limited to the SVG element, and the sibling-of-the-SVG hidden template would not be visible.

A `processedNodes` set tracks which DOM nodes have already been handled, so a `<div>` that contains a `<pre class="mermaid">` is matched by both `.mermaid` and `pre.mermaid` but processed once. The cost is one `Set` lookup per container; the benefit is correctness when multiple selectors match the same logical diagram.

## The five strategies, in order

For each matched container, the implementation tries the strategies below and stops at the first one that returns a non-empty string.

### 1. A `<script type="text/mermaid">` tag

Some integrations keep the source next to the SVG by injecting a `<script type="text/mermaid">` block. The script tag is non-executing, because the `type` attribute is `text/mermaid` rather than `text/javascript`, so the browser leaves it alone while mermaid.js consumes it during render. The implementation looks for the script tag inside the container first, and if that returns nothing, looks at the container's siblings. Both cases are the same strategy: "is there a `<script type="text/mermaid">` anywhere associated with this container".

The GitHub case uses the sibling form. A GitHub-rendered README has structure roughly like:

```html
<div class="mermaid" data-processed="true">
  <svg id="mermaid-1">...</svg>
</div>
<script type="text/mermaid">sequenceDiagram; Alice->>Bob: hi</script>
```

The source is in the next sibling, not inside the container. The order of "contained then sibling" is what lets the same code work for both MkDocs and GitHub without separate selectors.

### 2. A `data-*` attribute on the container

If no script tag is around, the next place to look is the container itself, specifically its data attributes. Five attributes are checked, in this order: `data-code`, `data-mermaid`, `data-src`, `data-original`, `data-source`. The first one that exists and is non-empty wins. The ordering is a guess at which attribute names different renderers tend to use; `data-code` and `data-mermaid` are the most common, `data-source` and `data-original` are fall-throughs for older or non-standard renderers.

### 3. The container's own text, when it is a `<pre>` with no SVG inside

This covers the case where the container was a `<pre>` holding the source text and the renderer has not yet replaced it with an SVG (an unprocessed diagram), or where a previous cleanup pass removed the SVG but left the source text behind. The implementation only takes this path when the container is a `<pre>` and contains no `<svg>`. The text is read directly from the element.

### 4. A hidden `pre[hidden]`, `<template>`, or `textarea[hidden]`

Some themes stash the original source in a hidden element next to or inside the rendered container, on the principle that the source should be visible to crawlers and screen readers even when the rendered SVG is the only thing the user sees. The implementation searches inside the container first, then among its siblings, and takes the first match. The `<textarea>` case reads its `value` rather than its text, because the contents of a textarea are not in its text node.

That covers the first four strategies. They are all "the source is around somewhere"; the implementation just has to find the right place to look. The fifth strategy is a different shape entirely, and the reason it is guarded so carefully.

### 5. SVG accessibility nodes, with a strict guard

The SVG itself carries a `<desc>`, `<title>`, and `aria-label`. The first two are part of the SVG accessibility spec; the third is a generic ARIA hook. Together they are where mermaid.js writes accessibility text describing the rendered diagram.

In a browser, mermaid.js writes strings like `Created with Mermaid` into those nodes. It is not a bug. The string is a screen-reader announcement, and screen readers actually benefit from hearing "this is a Mermaid diagram" when they encounter one. The same string is also used as a placeholder by some themes, as a build-time tag in others, and occasionally as a real label that does carry diagram info. The point is: the contents of those nodes are not reliable Mermaid source.

That is a problem because the previous strategies can fail. If the rendered SVG has no nearby script tag, no data attribute, no hidden template, and no `<pre>` with text, the implementation has one last thing to try: read whatever is in `<desc>` / `<title>` / `aria-label` and emit it as the diagram source. If the guard is too loose, the output is a Markdown fence containing `Created with Mermaid`, which is worse than dropping the diagram entirely. A literal accessibility string as a fenced Mermaid block is a guaranteed parse failure on the other side, a false diagram in the output, and a confusing experience for whoever has to clean it up later.

The guard is `isLikelyMermaidSource(text)` and it is deliberately strict. A candidate accessibility string passes only when one of three conditions holds:

- The text contains a newline or a `;`. Both are extremely common in real Mermaid source and extremely rare in a UI string. `graph TD; A-->B` has both. `Created with Mermaid` has neither.
- The text starts with a known diagram keyword. Twelve are recognised: `graph `, `flowchart `, `sequenceDiagram`, `gantt`, `classDiagram`, `stateDiagram`, `pie`, `erDiagram`, `journey`, `gitGraph`, `mindmap`, `timeline`. Note the trailing space on `graph ` and `flowchart `: it stops `graphs-data` style headings from matching. Note also the case-sensitivity: the keywords are exactly the camelCase or lowercase forms the parsers expect.
- The text starts with a keyword AND carries an arrow (`-->` or `->`), a colon (`:`), or is longer than 20 characters. The arrow or colon is the cheapest signal that the keyword is followed by an actual statement rather than just a heading. The length check is a third hedge against very short stubs that happen to start with a keyword.

In practice this means a candidate like `Created with Mermaid` is rejected: it has no newline, no `;`, and does not start with a diagram keyword. A candidate like `sequenceDiagram Alice->>Bob: hi` is accepted: it starts with a keyword, contains an arrow, and contains a colon. A candidate like `erDiagram` is rejected: it has the keyword but no arrow, no colon, and is only nine characters long. A candidate like `Graph: payments pipeline` is rejected: `Graph` with a capital G is not in the keyword list, and the rest is prose.

The guard is checked against `<desc>` first, then `<title>`, then `aria-label`. Each one is independent; a rejected `<desc>` does not skip `<title>` or `aria-label`. If none of the three passes, the function returns `null`, no fence is emitted, and the SVG is left alone. The downstream pass then handles the SVG's text labels as loose text, which is the same behaviour 1.6.0 had for diagrams with no recoverable source.

## Why this ordering

The four "source is around somewhere" strategies come first because, when they work, the result is the actual source the diagram was rendered from. There is no guessing, no language detection, no parsing. The script tag is the cleanest case: mermaid.js itself put the source there to render from, and the recovery is round-tripping what the page already had. Data attributes come next because some themes do not use script tags but still expose the source as a markup attribute. The container's own text is third because it only applies to the narrow `<pre>`-with-no-`<svg>` case, and hidden templates are fourth because they are renderer-specific.

The SVG accessibility nodes come last because they are the worst signal. They are designed for screen readers, not for recovery. When the first four strategies fail, the implementation is looking at a container that some theme rendered with no recoverable source, and the last-ditch option is to read accessibility text and guess whether it is real Mermaid source. The strict guard is what makes the guess safe. Without it, the recovery would happily emit `Created with Mermaid` as a fenced diagram, which the consumer would later have to repair. With it, the recovery emits a real diagram only when the candidate actually looks like one, and silently leaves the SVG in place otherwise.

## What happens when recovery succeeds

When any of the five strategies returns a string, the implementation rewrites the matched container into a `<pre><code class="language-mermaid">source</code></pre>` block. The `<pre>` has no class; the `<code>` carries `language-mermaid`. That is the same shape the preservation path emits for a Mermaid fence it found in the source, which means the downstream Markdown converter does not need to know whether a given Mermaid block came from preservation or recovery. Both arrive at the validator step as identical fenced blocks.

The rewriting also clears the SVG. Because the matched container is replaced in the DOM, the SVG and any sibling rendering cruft go with it. The replacement is `<pre>` wrapping `<code>` wrapping the recovered text, and that is what survives into the converted Markdown.

When recovery fails, no rewriting happens. The SVG stays in the DOM, and the downstream pass picks up its text labels as loose text. That is the intentional behaviour: a diagram with no recoverable source contributes whatever text the renderer put inside the SVG (node labels, edge labels), but no fence, no false Mermaid block, and no broken diagram later in the pipeline.

## How this shows up across the three main renderers

The same precedence handles GitHub, MkDocs, and Docusaurus, because the differences are mostly which strategies succeed first.

- GitHub. README Mermaid blocks render to `<div class="mermaid" data-processed="true"><svg id="mermaid-N">...</svg></div>` with a sibling `<script type="text/mermaid">`. Strategy 1 recovers, via the sibling-script branch.
- MkDocs with the official `mkdocs-material` Mermaid integration. Renders into a `<pre class="mermaid">` containing an SVG, with the source stashed in a hidden template or textarea for the client-side renderer to pick up. Strategies 3 and 4 recover.
- Docusaurus with `@docusaurus/theme-mermaid`. Renders into a `<div class="mermaid">` containing an SVG, with the source in a hidden template. Strategy 4 recovers.

The exact strategy that wins varies; the precedence is what makes the recovery robust across all three without needing per-renderer special cases.

## What gets validated next

The recovered fence is a regular ` ```mermaid ` block by the time it reaches the validator. If `validateMermaid: true` is on, the validator parses every block in the output (preserved, recovered, and model-generated alike) and annotates the failing ones with a `> [!WARNING]` callout. That means a recovered diagram whose source was slightly mangled by a custom theme's data-attribute handling is caught at the validation step rather than surviving into the consumer's prompt. The validator's environmental fix (the headless DOM install covered in a separate post) does not interfere with this path: by the time validation runs, the recovery step is long over, the DOM is whatever the host process wants it to be, and only the recovered fence matters.

## Test coverage

The five strategies are covered one-to-one in `mermaid-recovery.spec.ts`. Each test has a representative HTML fixture and asserts both that the recovered fence appears and that the original `<svg>` is gone. Two extra tests pin the edges the guard exists for: the bare `Created with Mermaid` accessibility string does not survive the guard and the SVG is left in place, and an SVG with no recoverable source at all is left alone with the SVG still present in the output. No false fence, no fallback to text labels, no special handling.

## What this is not

A few things are worth saying out loud so nobody is surprised.

- This is not OCR. The five strategies read text already present in the DOM. If a theme generates a diagram and discards the source entirely, recovery fails and the SVG's labels fall through as text.
- This is not parsing. The recovered string is emitted verbatim. If a custom attribute-handling script mangled it on the way in, it is mangled on the way out. The validator catches that case later, not here.
- This is not a replacement for the PDF vision path. A PDF diagram is raster or vector drawing, not DOM. The opt-in vision reconstruction, covered in the headline post, is the answer for that case.

## Where to read the code

The implementation is in `src/optimizers/mermaid-recovery.ts`. The full file is small: the container walk, the dedup set, the five strategies, and the `isLikelyMermaidSource` guard. The fixture set in `mermaid-recovery.spec.ts` has a representative example for each strategy plus the two edge cases the guard exists for. The runnable example in `examples/mermaid-diagrams.ts` covers recovery from a sibling `<script type="text/mermaid">` end-to-end through `convertToMarkdown`, so you can run it offline and see the recovered fence in the output.

Repo: https://github.com/Nano-Collective/get-md