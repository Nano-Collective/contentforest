---
product: get-md
version: "1.5.0"
channel: github-discussion
title: "Streaming results from hundred-url batches: how convertBatch works"
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

get-md v1.5.0 ships two batch entry points that do more than the name implies. `convertBatch()` is an async iterator that yields per-URL results as they complete. `convertBatchAll()` wraps it in a Promise that resolves to an array once everything is done. Here is what the design looks like from the inside and what you can do with it.

## The async iterator pattern

The key distinction between the two functions is buffering. `convertBatchAll()` is the straightforward convenience: pass it a URL list, await it, and get back `BatchResult[]`. That is useful when you need everything before the next step — but it means holding all results in memory.

`convertBatch()` gives you the iterator directly. You consume it with `for await (const result of convertBatch(urls))`. Each result resolves as soon as that URL finishes, not when the whole batch is done. For pipelines that pass individual results downstream — writing to disk, streaming to a database, feeding a queue — this matters.

```typescript
import { convertBatch } from "@nanocollective/get-md";

const urls = ["https://a.com", "https://b.com", "https://c.com"];
for await (const result of convertBatch(urls)) {
  console.log(result.markdown.length, result.url);
}
```

## Bounded concurrency

The batch runs with a concurrency cap (default 5, configurable via `--concurrency`). This is deliberate. `convertBatch()` yields an iterator, but underneath it is a pool of workers pulling from the queue. When one finishes, the next URL in the queue immediately takes its slot. No unbounded fan-out, no socket exhaustion.

The concurrency cap applies to both API and CLI. On the CLI, `--concurrency 10` would raise the cap to 10.

## JSONL output

`--json` in batch mode emits JSONL — one JSON object per line — not a single JSON array. That is intentional for shell pipelines. You can stream the output directly into `jq` or a database ingestion tool without waiting for the full batch:

```bash
getmd --batch urls.txt --json | jq -c '{url, size: .markdown.length}'
```

`--manifest` produces a single JSON summary when you do want the whole picture at once.

## Naming output files

The `--name-pattern` CLI flag controls how output files are named. The default is `{host}-{slug}.md`, but all four placeholders are available:

| Placeholder | Resolves to |
| --- | --- |
| `{host}` | hostname only |
| `{slug}` | path without leading slash, `/` replaced with `-` |
| `{path}` | full path, slashes included |
| `{index}` | zero-based position in the input list |

`{slug}` is the safest default for filenames — it avoids slashes in paths, which some filesystems handle poorly. Combining `{path}` with an explicit output directory (`-o out/`) gives you a directory tree that mirrors the source site.

## Failure handling

`--stop-on-error` controls what happens when a conversion fails. Default is to continue and report the failure in the result object. Switching to `--stop-on-error` causes the batch to throw on the first failure.

In the API, both functions accept the same options object. `stopOnError` is a boolean option. `concurrency` controls the pool size.

## What is not here

There is no built-in retry logic in the batch layer itself — that lives in the HTTP layer below it (v1.5.0 adds retry with `Retry-After` handling to the underlying `fetchUrl`). The batch iterator does not retry individual URL failures. If a URL returns 429 even after the HTTP layer's built-in retries, it surfaces as a failure result.

The reason for not layering retries in the batch itself: retry budgets are per-URL, not per-batch. A URL that has exhausted its retries is not going to succeed by waiting for other URLs to complete. Reporting the failure immediately keeps pipelines predictable.

## What this unlocks

The combination of streaming results, bounded concurrency, JSONL output, and the `--manifest` summary makes the batch API useful for pipelines that need to know partial results before the full batch is done — ingestion pipelines, automated quality checks, incremental archives.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
