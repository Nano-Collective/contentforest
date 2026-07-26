---
product: get-md
version: "1.7.0"
channel: github-discussion
title: "get-md v1.7.0: Mermaid diagrams survive the conversion, end to end"
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 12281
---

get-md v1.7.0 is out. Where 1.6.0 taught the library to read PDF, DOCX, and Markdown, this release is about not throwing away the one thing a Markdown converter usually destroys: **Mermaid diagrams**. v1.7.0 preserves Mermaid fences it finds, recovers the source from diagrams a browser has already rendered to `<svg>`, optionally reconstructs diagrams drawn into a PDF using a vision model, and optionally checks that whatever comes out actually parses. It also fixes a handful of real bugs surfaced along the way, including a validation path that was almost always wrong.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## What changed

Four diagram behaviours, on by default where they can be, opt-in where they need optional dependencies:

1. **Preserved.** A ` ```mermaid ` fence in your HTML or Markdown comes out the other side unchanged, fence and language tag intact. Same treatment for `dot`, `graphviz`, and `plantuml`, all newly registered as recognised language identifiers.
2. **Recovered.** When a docs site has already rendered a diagram to `<svg>` (the GitHub, MkDocs, and Docusaurus case), get-md pulls the original source back out of the DOM before Readability and the HTML cleaner can strip it.
3. **Reconstructed.** Diagrams drawn into a PDF can be rebuilt by a remote vision model. Opt-in, capped at the first 10 pages, and remote providers only.
4. **Validated.** `validateMermaid: true` parses every Mermaid block in the finished Markdown and annotates the ones that fail, keeping the original so you can repair it rather than losing it.

These cover the same problem from four angles, and each one is independently switchable. The default install footprint is unchanged. New capabilities that need rendering or parsing install their own optional peer dependencies.

## Preserved: Mermaid fences survive conversion

`mermaid` is now a recognised language identifier, alongside `dot`, `graphviz`, and `plantuml`. Previously a Mermaid block survived only by accident, through a loose lowercase-word fallback with no test coverage behind it.

A ` ```mermaid ` block in HTML (`<pre><code class="language-mermaid">`) or in a Markdown file comes out the other side unchanged, fence and language tag intact. The behaviour applies from both the library and the CLI, across HTML, URL, and `.md` input.

The release also fixes a general case that affects every syntax-highlighted page, not just Mermaid: the Mermaid recovery work sets `keepClasses: true`, so `<pre><code class="language-x">` keeps its class through extraction. Fenced output is now tagged, ` ```python `, ` ```go `, ` ```rust `, where it previously came out bare. This is the most visible change in the release for anyone converting documentation sites. Two consequences worth knowing: unrecognised class names can now surface as tags via the lowercase-word fallback, and because element classes survive into the cleanup pass, class-based noise rules match more often (a `cookie-notice` block is correctly dropped, but so is genuine prose carrying an `advertisement` or `popup` class).

## Recovered: Mermaid source from rendered SVG

GitHub, MkDocs, and Docusaurus run mermaid.js client-side, so the HTML you fetch holds the rendered `<svg>`, not the diagram. The source is usually still in the DOM somewhere, and get-md now goes looking for it before Readability and the HTML cleaner can strip it.

The recovery looks for these container shapes:

- `.mermaid`, `pre.mermaid`, `[data-processed="true"]`, `svg[id^="mermaid-"]`, and `svg.mermaid`.

For each container it tries the first source it can find, in this order:

1. A `<script type="text/mermaid">` inside or next to the container.
2. A `data-code`, `data-mermaid`, `data-src`, `data-original`, or `data-source` attribute.
3. The container's own text when it is a `<pre>` holding no `<svg>`.
4. A hidden `pre[hidden]`, `<template>`, or `textarea[hidden]`.
5. The SVG's `<desc>`, `<title>`, or `aria-label`.

That last fallback is deliberately strict. mermaid.js writes accessibility strings such as `Created with Mermaid` into those nodes, and emitting one as a diagram would be worse than dropping it. Text qualifies only if it is multi-line, contains `;`, or opens with a diagram keyword and carries an arrow, a colon, or real length.

Recovered diagrams are re-emitted as ` ```mermaid ` fences. Where no source is recoverable, behaviour is unchanged: the SVG's text labels fall through as loose text.

## Reconstructed: diagrams in PDFs by a vision model (opt-in)

A diagram in a PDF is vector drawing or raster image. There is no text to recover, so this is a vision problem. With `useLLM` and a remote vision-capable model, get-md renders PDF pages to images and asks the model to emit Mermaid inline where the diagram appeared.

A few constraints worth stating up front:

- **Remote providers only.** The local ReaderLM-v2 path is text-only, and so is `useLLM` with no `llm` config, since that defaults to local-llama. Neither renders pages nor calls a vision model.
- **New optional peer dependencies.** `pdfjs-dist` (^5) and `@napi-rs/canvas` (^0.1), installed only if you want this. Standard fonts resolve dynamically from the installed `pdfjs-dist`.
- **Capped at the first 10 pages**, to keep long PDFs from overflowing the model's context. Longer documents log a warning naming the cap; text extraction still covers the whole file.
- **Fails soft in both directions.** Missing render dependencies or a render error warns and continues text-only, and a failed vision request retries the same conversion without images.
- **Accuracy varies with the model and the diagram.** This is a best-effort assist, not guaranteed fidelity.

One limitation carried over from 1.6.0 and now worth stating explicitly: a PDF with no extractable text, a pure scan or a page that is nothing but a diagram, still returns an empty result before page rendering is attempted, so vision reconstruction never runs on exactly the PDFs that would benefit most.

## Validated: parse every Mermaid block (opt-in)

`validateMermaid: true` runs every ` ```mermaid ` fence in the finished Markdown through mermaid's own parser and annotates the ones that fail, so a model that emits plausible-but-broken Mermaid does not do so silently.

- Invalid blocks are **kept**, with a GitHub-style `> [!WARNING]` callout inserted above them. You repair the diagram rather than losing it.
- Applies to all Mermaid in the output: preserved, recovered, and model-generated alike, and runs last, after conversion and image localization.
- Available as the `validateMermaid` library option, the `--validate-mermaid` CLI flag, and a `validateMermaid` config-file key, across every conversion path: HTML, URL, Markdown, PDF, DOCX, batch, and sitemap.
- Requires the **optional** `mermaid` peer dependency (^11). Without it, get-md logs a warning and returns the Markdown untouched, so enabling the option can never break a conversion.
- Only non-indented triple-backtick fences are matched; indented fences may pass through unvalidated.

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

const result = await convertToMarkdown(source, {
  inputType: "markdown",
  validateMermaid: true,
});
```

## Bug fixes from the launch review

Three real bugs were caught while building this release, and a behavioural change worth its own callout.

- **Mermaid validation no longer rejects valid diagrams.** `mermaid.parse` sanitizes label text through DOMPurify, which needs a DOM. Under plain Node there wasn't one, so any diagram carrying node labels, things like `A[Start]`, `B{Choice}`, `-->|yes|`, and every class, state, ER, gantt, and mindmap diagram, threw `DOMPurify.addHook is not a function`, and the validator treated any throw as a syntax error. In practice almost every real diagram was annotated as invalid, including correct output from the PDF vision path this option exists to check. Validation now installs a headless DOM before importing mermaid (the point DOMPurify binds to the global scope) and restores the global scope afterwards, including `process`, which constructing a happy-dom `Window` replaces. Only a genuine parse complaint now annotates the document; anything environmental logs one diagnostic and leaves the diagram alone. Two diagram types (`pie`, `gitGraph`) still take that path, failing inside a lazily loaded mermaid parser chunk, and are skipped by the validator.
- **`--config <path>` is no longer ignored.** The flag was accepted, and `--show-config` even printed the path, but every conversion still loaded configuration through cwd/home auto-discovery. An explicitly named config file had no effect on output and its validation errors never surfaced, so a typo'd config failed silently. All five conversion paths and `--show-config` now resolve config through one helper that honors the flag.
- **Duplicate validation warnings prevented.** Re-running validation over already-annotated Markdown no longer stacks a second warning onto the same block. The fence-matching regex was also tightened for stability.
- **PDF rendering is loaded dynamically**, so the optional `pdfjs-dist` and `@napi-rs/canvas` dependencies are never touched unless vision reconstruction is actually in play.

## Behaviour change: code-block language tags survive

Already covered above, but worth its own callout because it affects every docs conversion, not just Mermaid. The recovery work sets `keepClasses: true`, so `<pre><code class="language-x">` keeps its class through Readability extraction. Fenced output is now tagged where it previously came out bare. The two tradeoffs above (unrecognised class names surfacing as tags, class-based noise rules matching more often) are real, and worth noting if your pages lean heavily on either.

## Installation

```bash
npm install -g @nanocollective/get-md

# Install this specific version
npm install -g @nanocollective/get-md@1.7.0
```

For the optional paths:

```bash
# PDF diagram reconstruction (vision)
npm install pdfjs-dist @napi-rs/canvas

# Mermaid validation
npm install mermaid
```

## Usage

```bash
getmd
```

Or from a script:

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

// From HTML string
const result = await convertToMarkdown("<h1>Hello</h1><p>World</p>");
console.log(result.markdown);

// From a Markdown file with validation
const validated = await convertToMarkdown(markdownSource, {
  inputType: "markdown",
  validateMermaid: true,
});
```

## Documentation

The new [Diagrams & Mermaid guide](https://docs.nanocollective.org/get-md/docs/guides/mermaid) covers the support matrix of what is preserved, recovered, reconstructed, and validated per input type, the recovery precedence order, setup and limits for the opt-in PDF path, and a troubleshooting table. The README gains a Mermaid section, and the runnable [`examples/mermaid-diagrams.ts`](https://github.com/Nano-Collective/get-md/blob/main/examples/mermaid-diagrams.ts) covers preservation, recovery, and validation entirely offline, with the PDF vision path as a commented snippet.

## Tests

634 passing (up from 592 at 1.6.0). New coverage for Mermaid fence preservation from HTML and Markdown, and the other diagram languages; source recovery across every container shape and source strategy, including the accessibility-text guard; PDF page rendering and the 10-page cap; vision prompting, multimodal message assembly, and text-only fallback; validation across nine diagram shapes that were previously false-positived, plus global-scope and `process` restoration; and the `--validate-mermaid` flag and `--config` resolution end-to-end through the CLI.

## Upgrading

```bash
npm install @nanocollective/get-md@1.7.0
```

Or:

```bash
pnpm add @nanocollective/get-md@1.7.0
```

Node.js 22 or later is required. No peer dependencies are required for the standard HTML/PDF/DOCX/Markdown paths. The new Mermaid and PDF-vision paths install their own optional dependencies when you opt in.

If you hit any issues or want to dig into the diagram recovery work, open an issue or find us on [Discord](https://discord.gg/ktPDV6rekE).

Repo: https://github.com/Nano-Collective/get-md
