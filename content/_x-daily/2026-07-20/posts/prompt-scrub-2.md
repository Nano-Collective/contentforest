---
kind: x-daily
date: "2026-07-20"
source: "prompt-scrub"
channel: x
angle: "Detector priority puts secrets above emails"
generated_at: "2026-07-20T04:06:43.119Z"
model: "minimax-m3"
char_count: 257
---

A URL with a token in it isn't a URL. prompt-scrub's collision chain picks SecretDetector over UrlDetector when spans overlap, so the bearer gets scrubbed as a secret, not a link. Missing a credential is treated as strictly worse than misclassifying a path.
