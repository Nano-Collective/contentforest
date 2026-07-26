---
product: get-md
version: "1.7.0"
channel: linkedin
title: ""
generated_at: "2026-07-26T18:51:01.751Z"
model: "minimax-m3"
char_count: 1892
---

Three limits in get-md 1.7.0's PDF diagram vision path, and why each one is on purpose.

The opt-in vision reconstruction in this release, remote model renders the first 10 pages of a PDF and asks for Mermaid back inline where a diagram appeared, looks, on paper, like a feature that should "just handle every PDF." It does not, and the limits are the feature.

1. **Remote providers only.** The local ReaderLM-v2 path is text-only. There is no vision input. Wrapping the local path with a fake vision layer would silently produce worse output. The gate in `supportsVision` is one short function: `useLLM` on, explicit `llm` config, `sdkProvider !== "local-llama"`. If you want diagrams, route through a remote multimodal provider.

2. **10 pages only.** A 2x JPEG is hundreds of thousands of pixels. Ask a vision model to read 400 pages and the context window crowds, the text degrades, and the diagrams you actually cared about come back worse. The cap is empirical and honest. A warning names it. Text extraction still covers the whole document.

3. **Pure scans short-circuit early.** A PDF with no extractable text still returns an empty result before the renderer is even called. The `emptyPdfResult` contract from 1.6.0, "this needs OCR", is preserved. The vision path is not OCR. Run OCR first if your input is a scan.

Two soft-fail paths sit on top: missing renderer dependencies warn and continue, and a failed vision request retries the same call text-only. Either way you get Markdown. Pair the path with `validateMermaid: true` and the soft-fail story is honest end-to-end.

The narrowness is the point. A vision path that handled every PDF, ran locally, and never failed would be the most expensive thing in the library, and would silently produce wrong output where it failed.

Full code walkthrough in the GitHub Discussion.

Repo: https://github.com/Nano-Collective/get-md