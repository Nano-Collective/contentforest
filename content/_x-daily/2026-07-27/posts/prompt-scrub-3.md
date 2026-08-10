---
kind: x-daily
date: "2026-07-27"
source: "prompt-scrub"
channel: x
angle: "CodeTell is opt-in for a reason"
generated_at: "2026-08-02T21:36:20.043Z"
model: "minimax-m3"
char_count: 274
distributed_at: "2026-08-10T15:48:13.556Z"
---

A custom identifier in your code is the one thing a regex won't catch. Generic terms on a code payload return noise, so prompt-scrub keeps CodeTellDetector off by default and a no-op. Pass codeTellTerms and it scans only your list, the way a private detector should behave.