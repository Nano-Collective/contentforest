---
product: get-md
version: "1.5.0"
channel: linkedin
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

Two functions shipped in get-md v1.5.0 for batching conversions. One is the straightforward version: pass a URL list, get an array back. `convertBatchAll()` does that.

The other is `convertBatch()`, which gives you an async iterator. You consume results as they finish, not when the whole batch is done. That matters when your pipeline is handing results off downstream before the last URL has converted.

Under the hood, both run through a bounded concurrency pool. Default cap is 5 simultaneous conversions, configurable with `--concurrency`. No unbounded fan-out, no socket exhaustion when running against a large list.

The CLI side adds a pattern that fits shell pipelines cleanly. `--batch <file> --json` emits one JSON object per line, not a single array. Pipe it straight into `jq` or a database ingestion tool and get results before the batch finishes.

The `--manifest <file>` flag is the counterpart when you do want the full picture at once.

Everything is documented at docs.nanocollective.org with a new batch guide and API reference page. Code examples and option details are in those docs.

The repo: https://github.com/Nano-Collective/get-md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
