---
kind: x-daily
date: "2026-08-31"
source: "nanotune"
channel: x
angle: "Local LLM judge, same config shape"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 268
---

7 providers, 1 config shape. nanotune judge configure treats OpenRouter, OpenAI, Anthropic, Gemini, Ollama, llama.cpp, and LM Studio the same. API keys resolve from the shell via ${ENV_VAR:-default}, so swapping a cloud judge for a local one is a base URL and a model id.