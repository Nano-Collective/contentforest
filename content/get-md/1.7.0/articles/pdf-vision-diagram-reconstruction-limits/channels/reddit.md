---
product: get-md
version: "1.7.0"
channel: reddit
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 3485
---

A short post about a part of get-md 1.7.0 I want to defend before someone files a "this should work for X too" issue.

The new opt-in PDF diagram reconstruction is the kind of feature that *looks* like it should be turned up. It renders the first 10 pages of a PDF to JPEG, sends them to a vision-capable model alongside the text, and asks for Mermaid fences back where the diagrams appeared. A reasonable reader's question is: why isn't this more aggressive? Why doesn't it run on every page of every PDF? Why doesn't it work locally? Why doesn't it handle scans?

The answer is that each limit encodes a tradeoff, and the tradeoff is the feature.

**Remote providers only.** The local ReaderLM-v2 path in get-md is text-only. There is no vision input. If we rendered pages for the local path, we'd burn the renderer budget for input the model would silently drop. The gate is a four-line function: `useLLM` on, an explicit `llm` config (because the default is local-llama), and `sdkProvider !== "local-llama"`. That's it. If you want PDF diagrams reconstructed, route through a remote multimodal provider. We load `pdfjs-dist` and `@napi-rs/canvas` lazily, only when that gate passes, so the default install footprint stays small.

**10 pages only.** A 2x JPEG is hundreds of thousands of pixels. Ask a vision model to read 400 pages and the multimodal message parts crowd the context window, the text degrades, and the diagrams you actually cared about come back worse. The cap makes the worst case predictable: a warning names it, and text extraction still covers the whole document. Lifting the constant without a chunked multi-request strategy would degrade the result on the same long documents. We picked 10 because it covers a typical whitepaper or design doc and stays inside a normal context window. If your diagrams cluster late, render that section as its own PDF. If they are scattered through 400 pages, this is not the right tool for the job yet.

**Pure scans short-circuit early.** A PDF with no extractable text returns an empty result before the renderer is even called. The `emptyPdfResult` contract from 1.6.0, "this needs OCR", is preserved. The vision path is not OCR. Run OCR first if your input is a scan. We considered letting the vision path run on scans, and the only honest version of that is also the most expensive path in the library, on the input type where the user is most likely to be unhappy with the cost. We chose not to.

**The two soft-fail paths on top.** Missing renderer dependencies warn and the conversion continues without images. A failed vision request retries the same call text-only, swapping the system prompt and dropping the image parts. Either way you get Markdown. Pair the vision path with `validateMermaid: true` and the soft-fail story is honest end-to-end: the validator catches what the vision model got wrong, the diagrams stay in the output with a `> [!WARNING]` callout for repair, and you do not silently lose content.

A vision path that handled every PDF, ran locally, and never failed would either not work, or be the most expensive thing in the library. The narrowness is the point. The limits are the shape of the feature.

If a limit blocks a real workflow for you, that is useful signal. Open an issue, or find us on Discord. But the limits themselves are not going to lift quietly, and I wanted to write down why before the first "why doesn't this do X" lands.

Repo: https://github.com/Nano-Collective/get-md