---
product: get-md
version: "1.7.0"
channel: linkedin
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 1831
---

get-md v1.7.0 is out. The headline is that Mermaid diagrams now survive HTML, URL, and Markdown conversions, end to end.

Where 1.6.0 taught get-md to read PDF, DOCX, and Markdown alongside HTML, this release is about not throwing away the one thing a Markdown converter usually destroys: diagrams. v1.7.0 handles Mermaid four ways:

- Preserved. A ` ```mermaid ` fence in your HTML or Markdown comes out unchanged, fence and language tag intact. On by default.
- Recovered. When a docs site has already rendered a diagram to `<svg>` (the GitHub, MkDocs, and Docusaurus case), get-md pulls the original source back out of the DOM. On by default.
- Reconstructed. Diagrams drawn into a PDF can be rebuilt by a remote vision model. Opt-in, capped at the first 10 pages, remote providers only.
- Validated. `validateMermaid: true` parses every Mermaid block in the finished Markdown and annotates the ones that fail, keeping the original so you can repair it rather than losing it. Opt-in.

Two related fixes shipped with the release. Code-block language tags now survive Readability extraction, so ` ```python `, ` ```go `, ` ```rust ` fenced output is tagged where it previously came out bare. And Mermaid validation no longer false-positives on every real diagram: a headless DOM is installed before mermaid loads, so DOMPurify-bound label sanitizing stops throwing.

The default install footprint is unchanged. The new PDF vision path needs optional `pdfjs-dist` and `@napi-rs/canvas`; the Mermaid validator needs optional `mermaid`. Standard HTML/PDF/DOCX/Markdown conversions work with no peer dependencies.

634 tests passing, up from 592 at 1.6.0.

Install: `npm install @nanocollective/get-md@1.7.0`

Full notes, examples, and the support matrix are in the GitHub Discussion.

Repo: https://github.com/Nano-Collective/get-md
