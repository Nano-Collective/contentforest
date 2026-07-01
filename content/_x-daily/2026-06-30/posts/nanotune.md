---
kind: x-daily
date: "2026-06-30"
source: "nanotune"
channel: x
angle: "A second model grades the first"
generated_at: "2026-06-30T04:23:09.209Z"
model: "minimax-m3"
char_count: 266
distributed_at: "2026-07-01T14:23:17.734Z"
---

Your fine-tune gives great open-ended answers. Then string matching tries to grade them and quietly lies. Nanotune's LLM-as-judge calls a separate model to score on criteria you name, 0-10 - the judge can be a different provider, so a local model grades a cloud one.