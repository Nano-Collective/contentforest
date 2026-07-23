---
kind: x-daily
date: "2026-07-20"
source: "get-md"
channel: x
angle: "The cache flag reuses work without changing output"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 259
distributed_at: "2026-07-23T16:31:54.074Z"
---

A 1000-page crawl with `--cache` isn't a clever optimisation. It's the normal case.

`get-md` stores successful responses under `~/.get-md/cache`, so reruns hit disk instead of the network. `--cache-max-age` is the only knob that decides whether you re-fetch.