---
kind: x-daily
date: "2026-08-24"
source: "nanocoder"
channel: x
angle: "API keys belong in env, not on disk"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 209
---

A checked-in API key is a leak waiting for a bot. nanocoder reads NANOCODER_PROVIDERS (or NANOCODER_PROVIDERS_FILE) over anything in agents.config.json, so your keys stay in the shell and the repo stays clean.
