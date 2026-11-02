---
kind: x-daily
date: "2026-11-02"
source: "sentinel"
channel: x
angle: "A dry run touches no cache"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 226
---

A preview should not warm the cache for the run after it. Sentinel (alpha) dry runs neither read nor write the incremental cache, so the audit that follows sees every file again and the preview records no pass it did not make.
