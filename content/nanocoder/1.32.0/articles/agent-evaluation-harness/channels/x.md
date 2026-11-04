---
product: nanocoder
version: "1.32.0"
channel: x
title: "Measuring an agent: the eval harness that scores a released tag, not your tree"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 277
---

New Nanocoder eval harness scores a released tag, not your tree. It shells out to `nanocoder --plain --json run`, and its fixtures ship distractor files so a run on degraded context fails an assertion instead of finishing cheaper.

https://github.com/Nano-Collective/nanocoder
