---
kind: x-daily
date: "2026-07-27"
source: "get-md"
channel: x
angle: "node-llama-cpp is an optional peer dep"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 243
---

Most get-md installs skip node-llama-cpp. Since v1.4.0 it's an optional peer, not a direct dep - so the ~95% who only need convertToMarkdown skip hundreds of MB of native binaries. Use the LLM path? A clear error points at the install command.