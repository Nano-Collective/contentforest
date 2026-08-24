---
kind: x-daily
date: "2026-08-24"
source: "prompt-scrub"
channel: x
angle: "Stable placeholders across turns"
generated_at: "2026-08-24T01:58:56.360Z"
model: "minimax-m3"
char_count: 279
---

Randomising placeholders per turn looks safer. It isn't. If "Email_1" becomes "Email_3" next turn, the change is the signal: the model pins you from what moved.

prompt-scrub pins one placeholder per identifier per session. Names stay still, so there's nothing left to correlate.