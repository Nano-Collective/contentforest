---
kind: x-daily
date: "2026-10-12"
source: "nanocoder"
channel: x
angle: "Checkpoints are git byte-for-byte, not a diff"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 270
---

Most checkpointer hooks store a patch, not the file. So a font or compiled binary - gone on revert. nanocoder's /checkpoint captures each file's full bytes, and skips its own .nanocoder/ tree so checkpoints never snapshot each other. Restore is exact, not reconstructed.
