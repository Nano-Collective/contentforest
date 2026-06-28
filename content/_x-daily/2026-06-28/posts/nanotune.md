---
kind: x-daily
date: "2026-06-28"
source: "nanotune"
channel: x
angle: "Read the failure list, then train"
generated_at: "2026-06-28T04:47:49.980Z"
model: "minimax-m3"
char_count: 244
---

More training data is rarely the fix for a fine-tune that fails. After `nanotune benchmark`, open the markdown report, read the failed tests table, and add examples targeting those exact prompts. Re-train on a smaller dataset that hits the gap.
