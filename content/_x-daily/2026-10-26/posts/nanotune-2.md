---
kind: x-daily
date: "2026-10-26"
source: "nanotune"
channel: x
angle: "Export fuses before it converts"
generated_at: "2026-10-26T04:50:19.162Z"
model: "minimax-m3"
char_count: 183
---

Do not fuse an adapter twice. nanotune export runs fuse, convert, quantize in that order, so --skip-fuse starts at the GGUF conversion when you have already fused the weights by hand.
