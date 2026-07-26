---
product: get-md
version: "1.7.0"
channel: github-discussion
title: "The three limits the PDF vision path keeps on purpose"
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 14387
---

The new opt-in PDF diagram reconstruction in get-md 1.7.0 is, by the numbers, a small feature. A handful of source files, an optional peer dependency pair, and a 10-page cap. The interesting part is not the feature itself. It is the three deliberate limits around it: remote providers only, a 10-page render cap, and a hard short-circuit on pure-scan PDFs. Each one of those limits looks, at first glance, like something a more complete implementation would lift. None of them should be lifted, and this post is the case for keeping them.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## What the path actually does

With `useLLM: true`, a remote vision-capable provider, and `pdfjs-dist` plus `@napi-rs/canvas` installed, get-md renders the first 10 pages of a PDF to JPEG images at 2x scale and sends them to the model alongside the extracted text. The model's system prompt asks it to emit Mermaid fences inline where a diagram appeared in the page. That output rides the same Markdown pipeline as a text-only result, including the new `validateMermaid` step.

The mechanics are spread across four files worth naming, because the limits live in each of them and it is useful to know where:

- `src/extractors/pdf-renderer.ts` renders pages to JPEG and enforces the 10-page cap with a `console.warn` naming it.
- `src/extractors/pdf-extractor.ts` extracts the text that the vision path is layered on top of, and short-circuits to an empty result when there is no text at all.
- `src/index.ts` holds `supportsVision`, `tryRenderPdfToImages`, and `emptyPdfResult`, and is the only place where remote-provider detection happens.
- `src/converters/remote-llm-converter.ts` is the path that actually talks to a vision model, including the soft-fail fallback to text-only when the vision request itself errors.

The headline release post covered the surface area. This one is the limits, and why they are not arbitrary.

## Limit one: remote providers only

The vision gate in `supportsVision` is short enough to quote in full:

```typescript
function supportsVision(options?: MarkdownOptions): boolean {
  if (!options?.useLLM) return false;
  if (!options.llm) return false; // defaults to local-llama without explicit config
  return options.llm.sdkProvider !== "local-llama";
}
```

Two conditions, both must hold. `useLLM` has to be on, and the configured provider has to be a non-local one. The `!options.llm` check matters: without an explicit `llm` config the path defaults to `sdkProvider: "local-llama"`, and that branch never even asks the question. This is the part that surprises people who turn on `useLLM` and expect the local path to magically handle diagrams.

The reason is honest, and it is about what local-llama actually is. The local ReaderLM-v2 path in this codebase is text-only. It has no vision input. It does not accept images. If the renderer fed it JPEGs, they would be ignored, dropped, or counted as a malformed user message, depending on the model. Running the renderer at all on a text-only path would burn the 10-page render budget for nothing the model can see.

So the gate is not a design preference. It is the absence of a feature that does not exist in the underlying model. The 1.7.0 release notes state this plainly: "The local ReaderLM-v2 path is text-only, and so is `useLLM` with no `llm` config, since that defaults to local-llama." A user who wants diagram reconstruction and runs locally has only one honest path today: route through a remote provider that supports multimodal input. Wrapping the local path with a fake vision layer would be a worse user experience than telling them up front.

The remote-only choice also keeps the default install footprint reasonable. `pdfjs-dist` and `@napi-rs/canvas` are loaded lazily, on demand, only when `supportsVision` returns true. A user who never sets `useLLM`, or who sets it without an explicit remote provider, never touches either dependency. The renderer is imported via `await import("./extractors/pdf-renderer.js")` and the canvas imports inside the renderer function itself, so the cost is paid only when the feature is used. Lifting the remote-only limit, in either direction, breaks one or the other of those properties.

There is one case the limit makes genuinely awkward, and it is worth naming: a privacy-respecting user who wants to run everything on their own hardware and is fine paying a model-quality cost for it. The current answer for that user is no, the PDF vision path will not work for them. The future answer is a vision-capable local model behind the same gate, but that is a different feature, not a relaxation of this one.

## Limit two: the 10-page render cap

The cap lives in one place:

```typescript
const MAX_PAGES_TO_RENDER = 10;
if (pdf.numPages > MAX_PAGES_TO_RENDER) {
  console.warn(
    `[get-md] PDF has ${pdf.numPages} pages, which exceeds the rendering limit of ${MAX_PAGES_TO_RENDER}. ` +
      `Only the first ${MAX_PAGES_TO_RENDER} pages will be processed for diagrams.`,
  );
}
const pagesToRender = Math.min(pdf.numPages, MAX_PAGES_TO_RENDER);
```

10 pages, with a warning that names the cap, and a `Math.min` so the loop never iterates past it. Text extraction still covers the whole document, so a long PDF loses only the diagram reconstruction, not the content.

The cap is not arbitrary. It is a context-budget decision that the model side enforces whether we like it or not. Each rendered JPEG at 2x scale is hundreds of thousands of pixels. A modern vision-capable model accepts a handful of images before the multimodal message parts crowd the context window, push out the text, and start producing degraded output on both. Asking the same model to reconstruct diagrams from page 1 through page 400 of a handbook is not a stretch goal. It is a request that gets back lower-quality Markdown for every page, including the ones the user cared about.

Picking 10 is partly empirical. It is enough pages that a typical whitepaper, slide deck, or design doc has its diagrams covered. It is small enough that even a multi-image request stays well inside a normal context window. Lifting it would not improve the result on long documents; it would degrade the result on the same long documents. Lifting it without degrading the result would require a chunked, multi-request strategy with merge logic, which is the kind of feature that needs design, not just a higher constant.

There is also a second reason, which is operational. The renderer holds onto `pdfjs-dist` and `@napi-rs/canvas` for the duration of a conversion. A 400-page render at 2x is a noticeable CPU and memory spike on the host process. The cap turns the worst case into a predictable one. A user who hits the cap gets a warning in stderr and the first 10 pages of diagrams; they do not get a multi-minute hang and an out-of-memory error.

The honest workaround for long PDFs is structural. If you know your diagrams cluster early, the cap covers you. If they cluster late, render the relevant section as its own PDF first. If they are scattered, this is not the right tool for the job yet, and the path would tell you that with a warning rather than producing a result that quietly degraded partway through.

## Limit three: pure-scan PDFs short-circuit early

This is the one the release notes call out as a known limitation:

> A PDF with no extractable text, a pure scan or a page that is nothing but a diagram, still returns an empty result before page rendering is attempted, so vision reconstruction never runs on exactly the PDFs that would benefit most.

The relevant code is in `src/index.ts`, in both the buffer and the URL paths:

```typescript
if (!pdfText.trim()) {
  return emptyPdfResult(buffer.length);
}
inputHtml = buildPdfHtml(reconstructPdfHtml(pdfPages), pdfMeta);
forceExtractContentOff = true;

const images = await tryRenderPdfToImages(buffer, options);
```

The vision render call sits *after* the empty-text short-circuit, not before it. The text comes back empty, `emptyPdfResult` returns a `MarkdownResult` with `markdown: ""` and `inputLength` set to the buffer size, and the function exits. `tryRenderPdfToImages` is never reached. The user gets an empty result that is the same shape a text-less PDF has produced since 1.6.0.

Read in isolation that looks like an oversight. In context it is the deliberate consequence of two earlier decisions. First, `pdf-parse` is the text extractor of record, and what it returns is the only signal the rest of the pipeline uses to decide the document is real. Second, the renderer is intentionally lazy: it imports `pdfjs-dist` and `@napi-rs/canvas`, hands pages to a vision model, and pays for all of that, only on a code path where text was extracted. Lifting the empty-text short-circuit to "still run the vision renderer and ask the model to read the whole thing" turns this from a cheap opt-in into the most expensive path in the library, on the input type where the user is most likely to be unhappy with the cost.

There is also a correctness angle. `emptyPdfResult` returns a result with `readabilitySuccess: false`, an empty body, and `inputLength` set. A caller that already learned in 1.6.0 to detect "this PDF yielded no text, treat it as needing OCR" gets the same signal in 1.7.0. The 1.6.0 release notes are explicit about this contract: "Scanned/text-less PDFs return an empty result with a non-zero `inputLength` (a signal OCR is needed)." Carrying the contract forward in 1.7.0, even with a vision path sitting one branch away, is the conservative move. A user who expects "give me back what you can, even if the text is empty" would get a worse tool, not a better one.

The honest fix for the pure-scan case is upstream: run OCR, or use a tool whose job is OCR, then feed the OCR'd text back in. The vision path will not paper over that for you, and that is the right design call.

## What "fails soft" actually means here

There are two fail-soft paths layered on top of the three limits, and they are part of the same opinion. The renderer fails soft when dependencies are missing or a render throws: a `console.warn` and the conversion continues without images. The vision request fails soft when the model itself rejects the multimodal message: `RemoteLlmConverter.convert` catches the error, swaps in the text-only system prompt, drops the image parts, and retries the same call. Either way the user gets Markdown. They get less Markdown than the full path promised, but they get Markdown.

The retry is interesting because it is the only place in the path where the user-facing text could change shape. The vision request produces a richer system prompt ("you are provided with the text of the page, as well as images of the rendered page, if the page contains diagrams, flowcharts, or architecture diagrams, reconstruct them as Mermaid code block fences"). The fallback reverts to the plain text-to-Markdown system prompt. The text the model sees is the same; what it does not see is the images. A user who later turns off `useLLM` and re-runs the same file should land on the same text-only path, and the fallback makes the failure mode of "vision did not work this run" behave the same as "vision was not asked this run".

Pair this with `validateMermaid: true` and the soft-fail story is honest end-to-end. A user who runs the vision path gets whatever the model thinks the diagrams were. A user who pairs that with validation gets any reconstruction the model got wrong, flagged with a `> [!WARNING]` callout, kept in the output for repair. The two features are designed to be used together, and the limits in the vision path are written with the assumption that the validator will catch what the vision model misses.

## What the limits are not

Three things the limits are not, because each one comes up in user feedback:

- They are not a sign the feature is unfinished. A finished-feeling vision path that quietly degrades long PDFs, quietly fails on scans, and quietly ignores the local provider would be worse than the version that warns loudly and stops at the right edge.
- They are not a roadmap commitment to lift them. "Remote providers only" depends on a vision-capable local model existing and being integrated, which is a different feature. "10 pages" depends on a chunked multi-request strategy that does not exist yet. "No empty text" depends on a different extraction path that does not exist yet.
- They are not a restriction on what users can do. Every limit has a clean escape hatch the docs spell out: a remote provider with multimodal support, a sectioned PDF or a different tool for long documents, OCR or a separate OCR-first pipeline for pure scans. The limits are the shape of the feature, not a wall around it.

## What we kept, and what we did not

The PDF vision path in 1.7.0 is what survived the review pass: a deliberately narrow feature with three limits and two soft-fail paths, every limit encoding a tradeoff the user should be able to reason about. The narrowness is the point. A vision path that handled every PDF, ran locally, and never failed would either not work (it would silently produce wrong output), or be the most expensive thing in the library (it would run heavy multimodal inference on every scan, every long PDF, every input type).

The constraints below are the ones we kept:

- Remote providers only, because local-llama is text-only by design.
- 10 pages only, because context budget and host memory are real and the cap makes both predictable.
- No pure scans, because empty text is the contract that lets the rest of the pipeline tell "this is a real PDF" from "this is a scan that needs OCR".

If you want to dig into the renderer or the soft-fail paths, `src/extractors/pdf-renderer.ts`, `src/converters/remote-llm-converter.ts`, and the `supportsVision` and `emptyPdfResult` helpers in `src/index.ts` are the entry points. The [Diagrams and Mermaid guide](https://docs.nanocollective.org/get-md/docs/guides/mermaid) and [Remote LLM guide](https://docs.nanocollective.org/get-md/docs/guides/remote-llm) document the configuration shape and the failure modes end-to-end. Feedback on the limits, especially the ones that hurt your workflow, is welcome on GitHub or Discord.

Repo: https://github.com/Nano-Collective/get-md