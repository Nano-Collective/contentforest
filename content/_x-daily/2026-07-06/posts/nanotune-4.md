---
kind: x-daily
date: "2026-07-06"
source: "nanotune"
channel: x
angle: "Small models, exportable to GGUF"
generated_at: "2026-07-07T19:16:43.402Z"
model: "minimax-m3"
char_count: 240
---

A 0.5B to 1.5B fine-tune is useless if it can't leave your laptop. nanotune export fuses your LoRA into the base and writes GGUF down to q4_k_s, so you drop the same file into llama.cpp, Ollama, or LM Studio without rebuilding anything.