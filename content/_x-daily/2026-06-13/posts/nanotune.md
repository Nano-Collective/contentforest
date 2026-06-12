---
kind: x-daily
date: "2026-06-13"
source: "nanotune"
channel: x
angle: "Export to GGUF for local use"
generated_at: "2026-06-12T13:26:19.299Z"
model: "minimax-m3"
char_count: 261
---

Trained a LoRA with nanotune? `nanotune export` fuses it back into the base model and writes a GGUF file, quantized to f16, q8_0, q4_k_m, or q4_k_s. Drop into llama.cpp or Ollama. Pre-built binaries, no compile step.

https://github.com/Nano-Collective/nanotune
