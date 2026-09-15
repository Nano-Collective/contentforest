---
kind: x-daily
date: "2026-09-07"
source: "json-up"
channel: x
angle: "migrate-walks-version-by-version"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 278
---

A schema bump that rewrites your store loses records that don't fit the new shape. Tip: keep the old shape, add a step. json-up's migrate() walks _version forward through your chain, each up() running on the previous step's output, so v3 records come back upgraded, not rebuilt.
