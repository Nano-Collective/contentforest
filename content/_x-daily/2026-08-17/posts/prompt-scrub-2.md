---
kind: x-daily
date: "2026-08-17"
source: "prompt-scrub"
channel: x
angle: "Hallucinated placeholders pass through"
generated_at: "2026-08-17T01:56:19.919Z"
model: "minimax-m3"
char_count: 274
---

When the model invents a placeholder that isn't in the session map, prompt-scrub doesn't crash and doesn't silently rewrite. The string passes through verbatim, a warning lands on stderr. A hallucinated Secret_2 reaches the user as the literal text "Secret_2". Fail visibly.
