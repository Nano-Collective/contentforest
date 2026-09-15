---
kind: x-daily
date: "2026-09-07"
source: "get-md"
channel: x
angle: "json-flag-streams-jsonl-for-jq"
generated_at: "2026-09-07T04:44:39.731Z"
model: "minimax-m3"
char_count: 279
---

A JSON array from a CLI looks great in the README and breaks the moment you try to pipe it. One element, one line, one `jq` filter - that's the shape Unix was built around. `get-md --batch --json` writes one result per line, so it lands straight in `jq` without a wrapper script.
