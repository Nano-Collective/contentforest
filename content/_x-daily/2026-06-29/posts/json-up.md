---
kind: x-daily
date: "2026-06-29"
source: "json-up"
channel: x
angle: "Validate what each up function returns, not what it received"
generated_at: "2026-06-29T04:57:52.338Z"
model: "minimax-m3"
char_count: 256
---

Your migration's `up` function said it returned v2. It didn't. Most libraries trust the call. json-up runs the v2 Zod schema against what the function actually returns, because promises at a version boundary should be structurally enforced, not just typed.
