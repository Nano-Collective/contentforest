---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

A detail from get-md v1.5.0 that is easy to miss until it breaks your pipeline: many sites do not put the real image URL in the `src` attribute.

Wikipedia puts the actual image in `data-src`. Medium loads it in `data-original`. Substack and most modern blog platforms use lazy loading, which means the visible attribute is the placeholder and the actual URL lives elsewhere. Older versions of get-md stripped those attributes as noise, leaving 1x1 placeholders in the markdown. It looked like a successful conversion and was useless for any pipeline that needs the images.

v1.5.0 handles this. The HTML cleaner now preserves `data-src`, `data-original`, `data-lazy-src`, and `srcset`, resolves them against the base URL, and downloads the actual image.

Two other details worth knowing if you are putting this into a RAG pipeline: filenames are a SHA256 prefix of the image content, not the URL, so re-runs produce identical filenames and your pipeline can check for staleness without re-reading file contents. And when `--output-path` is also set, the rewritten image path in the markdown resolves relative to the markdown file directory, so the whole unit (markdown + images) moves as a folder without extra config.

Per-image failures log a warning but never fail the conversion. The markdown saves regardless.

https://github.com/Nano-Collective/get-md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
