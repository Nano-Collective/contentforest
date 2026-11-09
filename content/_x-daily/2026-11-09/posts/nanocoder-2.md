---
kind: x-daily
date: "2026-11-09"
source: "nanocoder"
channel: x
angle: "A reviewer that cannot merge"
generated_at: "2026-11-09T06:34:21.795Z"
model: "minimax-m3"
char_count: 277
---

An automated reviewer that can approve a PR is one bad diff from approving a bad diff.

`nanocoder verify --pr <n>` reads the diff, runs Semgrep over changed files, prints or posts a comment. It never approves, never requests changes, cannot block a merge.

Advice, not a gate.
