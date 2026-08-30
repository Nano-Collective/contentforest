---
product: nanotune
version: "1.7.0"
channel: linkedin
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 1721
---

If your Nanotune benchmark numbers moved after upgrading to v1.7.0, that is the feature, not a regression. The new defaults are temperature 0 and a fixed seed of 42, so two consecutive runs against the same model now produce identical scores. The numbers you had before were sampled at temperature 0.8 and are not comparable to the new ones, so a re-baseline is unavoidable.

The re-baselining workflow is short. Run a default `nanotune benchmark` to anchor the new baseline. Run `nanotune benchmark --base` once per base model as a control - first run is slow because it downloads and quantizes the base, every subsequent project fine-tuning from the same base reuses the cache. From there on, every training run ends with a benchmark and a `nanotune benchmark compare` against the previous fine-tuned run, not against the base. The base is your floor; the previous fine-tune is your peer.

The three commands answer three different questions. `nanotune benchmark` answers "what is my model doing today." `nanotune benchmark --base` answers "what does the starting point look like." `nanotune benchmark compare` answers "did this change help." Picking the wrong one is the most common way to end up with numbers that look meaningful and are not.

If you want to know how stable a score is, `--temperature 0.8 --samples 5` runs each test five times and reports per-test pass rate and variance. A 5/5 pass and a 3/5 pass both count as a pass overall but they are very different signals. Reach for multi-sample runs on tests where the pass rate is wobbling, not on every iteration.

The full workflow, the rationale, and what to do about CI thresholds are on the project repo at https://github.com/Nano-Collective/nanotune.
