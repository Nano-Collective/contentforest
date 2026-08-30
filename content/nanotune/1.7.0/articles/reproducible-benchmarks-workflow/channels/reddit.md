---
product: nanotune
version: "1.7.0"
channel: reddit
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 2369
---

We changed the default sampling behaviour in Nanotune v1.7.0 and the post we owe people is: here is how to re-baseline your project without losing your mind or your old numbers.

Up to 1.6.x, `nanotune benchmark` ran at temperature 0.8 with no seed and one sample per test. The score you saved was one coin flip. Two adjacent runs against the same model could differ by a few points for no reason. The new defaults are temperature 0, seed 42, one sample. Two runs match. The score is stable. Existing numbers move because they were drawn from a different distribution and cannot be averaged with new ones.

Here is what we landed on for re-baselining. First, do not delete your old reports - they are evidence of what the model did under sampling. Second, run `nanotune benchmark` with no flags and save the report. That is your new anchor. Third, run `nanotune benchmark --base` once per base model. The first run downloads and quantizes the base model, which is slow, but the result is cached under `~/.nanotune/models/base-cache/` keyed by model id and quantization, so every project fine-tuning from the same base pays that cost once. Fourth, `nanotune benchmark compare` the base against your fine-tuned baseline so you can see where fine-tuning is actually buying you something.

From there on, the per-iteration cycle is a benchmark and a compare against the previous fine-tuned run, not the base. The base is the floor; the previous fine-tune is the peer. Most of the time you want to know whether this training run beat the last one. The base comparison is the right tool less often than people reach for it.

A few small things worth knowing. `--samples 5x` used to silently run a single sample; it now fails with a message naming the flag, on purpose, so a score is never reported under settings you did not ask for. A benchmark run whose llama-server dies now saves partial results and scores against what actually ran, with a note. The `compare` command matches tests by id, so if you edited tests.json between two runs the changed ids are surfaced as dropped-and-added rather than as spurious flips.

The re-baselining itself is one slow run (the base) and one fast run (the baseline) per base model, then a benchmark plus a compare per training iteration. The full writeup with the workflow in one place is at https://github.com/Nano-Collective/nanotune.
