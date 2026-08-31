---
kind: x-daily
date: "2026-08-31"
source: "get-md"
channel: x
angle: "JSONL streaming for batch pipelines"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 234
---

A batch tool that buffers everything before exiting is a batch tool you can't pipe. get-md --json writes one record per line, so jq, dashboards, and downstream jobs see URLs the moment they complete - not after the last one finishes.
