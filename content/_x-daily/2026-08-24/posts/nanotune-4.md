---
kind: x-daily
date: "2026-08-24"
source: "nanotune"
channel: x
angle: "Export writes GGUF directly"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 247
---

The slow part of fine-tuning is never the training run. It's the convert-and-pray that comes after. Nanotune's export writes a GGUF the same day, so the trained model drops straight into Ollama or llama.cpp without a conversion script in between.