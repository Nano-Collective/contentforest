---
kind: x-daily
date: "2026-08-24"
source: "nanocoder"
channel: x
angle: "Disable timeouts for local models"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 260
---

A local agent doesn't crash loudly. It stalls on a long token, then dies at the 2-minute default. nanocoder's agents.config.json: requestTimeout and socketTimeout both to -1 in your local-provider block. Agentic loops on a laptop routinely exceed the default.
