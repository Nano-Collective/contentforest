---
kind: x-daily
date: "2026-11-02"
source: "json-up"
channel: x
angle: "Missing version means zero"
generated_at: "2026-11-02T06:08:04.111Z"
model: "minimax-m3"
char_count: 176
---

Drop the _version field and nothing complains. json-up reads the file as version 0 and replays your whole migration chain, so the steps that already ran on that data run again.
