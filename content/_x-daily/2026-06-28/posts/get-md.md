---
kind: x-daily
date: "2026-06-28"
source: "get-md"
channel: x
angle: "95% of users do not need the LLM dep"
generated_at: "2026-06-28T04:47:49.980Z"
model: "minimax-m3"
char_count: 223
---

95% of users only need convertToMarkdown. get-md keeps node-llama-cpp an optional peer dep so the standard HTML→Markdown path ships without it. The local ReaderLM-v2 model is 1.12GB - opt in with npm install node-llama-cpp.