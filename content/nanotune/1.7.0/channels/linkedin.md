---
product: nanotune
version: "1.7.0"
channel: linkedin
title: "Nanotune v1.7.0: benchmarks are reproducible by default"
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 100
---

Nanotune v1.7.0 is out. It is the largest release we have shipped since 1.0, and it lands in three places that have come up in nearly every issue thread we have read this year.

Benchmarks are now reproducible. `nanotune benchmark` defaults to `temperature: 0` with a fixed seed of `42`, so two consecutive runs against the same model produce identical results. A new `--samples <n>` flag runs each test multiple times and records variance. `benchmark compare` diffs two saved runs per test and per category, and `benchmark --base` benchmarks the pre-fine-tuning model so a fine-tuned score has something to be measured against. Heads up: existing benchmark numbers were sampled at temperature 0.8, so re-baseline anything you are tracking.

`nanotune chat` now streams tokens over SSE as the model generates them, instead of waiting for the whole reply. Press `Esc` to cancel a turn in flight; what was already generated stays in the conversation history. New `/save` and `/keep` slash commands capture transcripts and append exchanges straight to `train.jsonl` without retyping.

Every training hyperparameter is now a CLI flag on `nanotune train`: `--batch-size`, `--num-layers`, `--lora-rank`, `--lora-alpha`, `--lora-dropout`, `--fine-tune-type` (`lora`, `dora`, or `full`), `--grad-checkpoint`, and the rest. Flags are validated against the config schema before training starts, so a typo fails immediately rather than inside `mlx_lm` minutes later. Ctrl+C now stops training gracefully, flushes the checkpoint, and reports the actual last-saved iteration so you know whether to resume.

Other fixes worth flagging: `data list --eval` no longer writes edits back into `train.jsonl` (silent corruption, fixed); CSV import handles a leading UTF-8 BOM; `--base` cache sweeps no longer delete another running export's `.tmp-*.gguf`; `judge.json` is written to a fresh `0600` temp file and renamed atomically so an API key cannot briefly sit at looser permissions.

Plus `data export` to JSONL, CSV, or JSON; `data validate --fix` and `--rewrite-context`; in-place editing of training examples; and `config.json` typo warnings with suggestions. 452 tests, +213 since 1.6.0.

Source, issues, and the full changelog: https://github.com/Nano-Collective/nanotune