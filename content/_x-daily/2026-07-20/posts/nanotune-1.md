---
kind: x-daily
date: "2026-07-20"
source: "nanotune"
channel: x
angle: "Multi-turn examples live in the same JSONL row"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 257
---

One JSONL row can be a full conversation. Nanotune keeps every turn in the same `messages` array, so the `/greet` example and the follow-up `/my name is` example train together. `data validate` catches a broken role alternation before you burn GPU on a run.
