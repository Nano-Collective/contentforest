---
product: get-md
version: "1.5.0"
channel: reddit
generated_at: "2026-05-25T21:29:04.902Z"
model: "minimax-m2.7"
char_count: 0
---

Two functions shipped for batch conversion in get-md v1.5.0. `convertBatchAll(urls)` is the simple one: pass a list, await, get an array back. `convertBatch(urls)` is the async iterator version. You consume it with `for await`.

The async iterator is the part worth knowing. Most use cases will reach for `convertBatchAll()` first and that works fine. But if your pipeline needs to write partial results to disk, stream into a database, or feed a queue before the batch finishes, `convertBatch()` lets you act on each result as it completes rather than after all of them.

Both go through the same concurrency pool. Default cap is 5 at a time, configurable with `--concurrency`. The batch itself does not layer retry logic — retry lives in the HTTP layer below it, and specifically in v1.5.0's `Retry-After` header handling.

The CLI flag `--json` in batch mode emits JSONL, one object per line. That makes the output pipeable to `jq` directly without waiting for the full batch.

There is a full guide in the docs at docs.nanocollective.org with code examples for both API patterns and the full CLI flag reference.

https://github.com/Nano-Collective/get-md

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
