---
kind: x-daily
date: "2026-08-17"
source: "nanocoder"
channel: x
angle: "Per-project daemon owns events"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 236
---

The old scheduler lived inside the TUI. Close the terminal and file watches stopped, cron stopped, triggered runs shared whatever mode the TUI was in. nanocoder daemon exists because event-driven work can't ride on a foreground process.