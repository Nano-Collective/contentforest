---
kind: x-daily
date: "2026-10-12"
source: "nanotune"
channel: x
angle: "Regime selection is data-shape, not size"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 218
---

Model size doesn't pick your fine-tune regime: a 1.5B can land in LoRA, DoRA, or Full depending on the dataset. nanotune treats it as a first-class knob (training.fineTuneType, or --fine-tune-type), not a wizard guess.