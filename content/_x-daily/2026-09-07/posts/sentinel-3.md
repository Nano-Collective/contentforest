---
kind: x-daily
date: "2026-09-07"
source: "sentinel"
channel: x
angle: "rule-pack-identity-is-the-body-hash"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 195
---

One rule, two file locations, same identity. Sentinel rule packs are hashed by their body content, not the line anchors inside the source. Move the rule, rename the file, the cache key stays put.