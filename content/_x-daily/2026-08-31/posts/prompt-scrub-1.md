---
kind: x-daily
date: "2026-08-31"
source: "prompt-scrub"
channel: x
angle: "Detect secrets first, always"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 227
---

8 detectors, 1 priority chain. Secret wins, then Email, Url, Path, Phone, Address, Name, CodeTell. When a URL carries a credential shape, the token wins and the URL rewrites around it. Missing a credential beats missing a name.
