---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "What get-md v1.5.0 actually downloads when it localises images"
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

Image localisation in v1.5.0 does more than make local copies. It handles lazy-load attributes, resolves paths relative to the markdown output location, and deduplicates by content so re-runs produce the same filenames. Here is what each part actually does.

## What gets downloaded

`downloadImages: '<dir>'` (CLI: `--download-images <dir>`) downloads images referenced in the HTML that get-md is converting. It follows the `src` attribute, plus these lazy-load attributes when it encounters them: `data-src`, `data-original`, `data-lazy-src`, and full `srcset` descriptors.

Wikipedia, Medium, Substack, and most modern blog platforms use lazy-load attributes to defer image loading until the user scrolls. The old HTML cleaner stripped these, replacing actual images with 1x1 placeholders in the markdown. v1.5.0 preserves the lazy-load attributes and resolves their values against the base URL.

If an image fails to download, a warning is logged. The conversion continues and the markdown is written — the image slot in the markdown is left with whatever the original src was. The conversion never fails because of a bad image.

## Deduplication by content

Image URLs are deduplicated before downloading. If the same image URL appears multiple times in the HTML — common for logos, icons, and shared assets — it is fetched once. The filename is a SHA256 prefix of the image data, not the URL. Using content rather than URL means that `https://example.com/a.png` and `https://cdn.example.com/a.png` (different host, same content) are correctly treated as the same image.

Re-running the same conversion produces the same filenames. This matters for RAG pipelines that store embeddings keyed to source file paths — a re-run without changed content produces the same filenames, so the pipeline can check for staleness without comparing file contents.

## Path rewriting relative to outputPath

When `outputPath` is set, the rewritten image path is relative to the markdown file's directory. Setting `--download-images assets/ --output-path out/page.md` produces `./assets/<filename>` in the markdown, not an absolute path and not a path relative to the working directory. This means the markdown file and its images move together as a unit.

No extra configuration is needed. The output path of the markdown file encodes the correct relative path to the images directory, and get-md uses that relationship when rewriting.

## CLI auto-baseUrl

When the positional argument is a URL (not a file path), the CLI sets the base URL implicitly to that URL. Relative image refs like `/images/logo.svg` resolve correctly without needing `--base-url` explicitly. This makes a common case work without extra flags.

## The problem this solves for RAG pipelines

A RAG pipeline ingesting markdown with remote image URLs faces two problems: the images can go stale or 404, and the markdown contains URLs pointing at external infrastructure that the pipeline does not control. Image localisation solves both by making the images local and making the markdown refs relative.

Lazy-load handling matters because pipelines that scraped markdown from sites like Wikipedia without preserving `data-src` got 1x1 placeholders. Those look like a successful conversion but they are useless for any pipeline that tries to use the images.

## What is not here

Image localisation does not resize, compress, or convert image formats. It downloads the image as-is. If a page serves a 4MB PNG, you get a 4MB PNG. There is no thumbnail generation, no format conversion, and no lazy-load removal — the HTML cleaner stops after preserving the attributes for download and rewrite.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
