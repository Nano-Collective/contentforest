---
product: nanotune
version: "1.7.0"
channel: reddit
title: "Nanotune v1.7.0: benchmarks are reproducible, chat streams, training is flag-driven"
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 100
---

Hey r/LocalLLaMA. We just shipped Nanotune v1.7.0, the biggest release we've cut since 1.0. A lot of it came out of conversations people have been having in issues and on Discord.

For context: Nanotune is our CLI for fine-tuning small language models on Apple Silicon. MLX on the training side, llama.cpp for inference and benchmarks, an interactive Ink TUI in between. This release doesn't add new model support; it tightens almost everything people told us was fragile.

## Benchmarks are reproducible now

This is the one we care about most. Up to 1.6.x, `nanotune benchmark` ran at temperature 0.8 with no seed and a single sample per test. That meant running the same suite twice produced different numbers, and a 3-point swing in your pass rate could be a real regression or just sampling noise. Not great when the whole point of the tool is to give you a score.

v1.7.0 changes the defaults to `temperature: 0` with a fixed seed of `42`. Two runs against the same model now produce identical results. If you want the old sampling behaviour, it's a flag:

```bash
nanotune benchmark --temperature 0.8
```

There are two new flags and one new subcommand on top of the defaults:

- `--samples <n>` runs each test `n` times and reports per-test pass rate and variance in both reports. A test passes when the majority of its samples pass. Each sample uses `seed + sample_index`, so runs stay reproducible while the samples differ.
- `nanotune benchmark compare` diffs two saved runs and reports what moved, per test and per category. With no arguments it compares the two most recent runs.
- `nanotune benchmark --base` benchmarks the base model before any fine-tuning, as a control. The result is cached under `~/.nanotune/models/base-cache/` keyed by model id and quantization, so projects fine-tuning from the same base pay that cost once.

One heads-up: **existing benchmark numbers will move**. They were sampled at temperature 0.8; re-running the same suite will produce a different, and from now on stable, figure. Re-baseline anything you're tracking.

We also fixed a quiet but nasty class of bugs in the CLI flag parsing: `--temperature`, `--seed`, and `--samples` now reject a value they can't parse instead of falling back to the default. `--samples 5x` used to silently run a single sample; it now fails with a message naming the flag, so a score is never reported under settings you didn't ask for.

## `nanotune chat` streams

This one is overdue. `nanotune chat` used to wait for the entire reply before printing anything, so a long answer looked like a hung terminal. Tokens now stream in over SSE as the model produces them.

Press `Esc` to cancel a generation in flight. Whatever had been generated is kept and stays in the conversation history, so the transcript on screen and the history the model sees never disagree. Cancelling a turn that produced nothing rolls it back entirely.

We also added `/save` and `/keep` slash commands. The best training examples tend to surface during a chat, and there was no way to capture them without retyping into `data add`. `/save [file]` writes the transcript to `.nanotune/chats/` (and refuses to overwrite unless you pass `--force`, since transcripts can't be recovered once they're gone). `/keep` appends the last exchange straight to `train.jsonl`.

## Training hyperparameters are CLI flags

Up to 1.6.x, tuning a run meant hand-editing `config.json`. Every training hyperparameter now has a flag:

```bash
nanotune train --batch-size 8 --num-layers 8 --lora-rank 16 --lora-alpha 32
```

New flags: `--batch-size`, `--num-layers`, `--steps-per-eval`, `--save-every`, `--fine-tune-type` (`lora`, `dora`, or `full`), `--lora-rank`, `--lora-alpha`, `--lora-dropout`, `--max-seq-length`, `--grad-checkpoint` / `--no-grad-checkpoint`, `--val-batches`, and `--train-seed`.

Flags override `config.json`; anything you don't pass keeps its configured value. Values are validated against the config schema before the run starts, so a bad number fails immediately with a message naming the flag rather than dying inside `mlx_lm` minutes later. `--fine-tune-type full` skips the LoRA parameter block entirely.

Two related fixes worth calling out:

- **Ctrl+C stops training gracefully now.** Ctrl+C used to tear the app down while MLX was still writing. Training now stops on a signal, MLX flushes its checkpoint, and the summary reports the actual last-saved iteration. A second Ctrl+C gives up on the checkpoint. Interrupted runs exit `130`.
- **The train/validation split is visible.** `ensureValidationSet()` silently moved ~10% of `train.jsonl` into `valid.jsonl` on the first run, so the training-example count dropped with no explanation. The split is now reported when it happens. `--seed <n>` makes it reproducible.

## Working with the validation set

Every `data` subcommand takes `-e, --eval` to operate on `valid.jsonl` instead of `train.jsonl`:

```bash
nanotune data add --eval
nanotune data list --eval
nanotune data import extra.jsonl --eval
nanotune data validate --eval
nanotune data export valid-backup.jsonl --eval
```

`data validate` no longer warns that a validation set has fewer than 50 examples. A validation set is a slice of the training data, so that floor never applied to it and the warning was noise on a correct split.

`data export` now writes JSONL, CSV, or JSON depending on the output file's extension. JSONL and JSON round-trip exactly, including multi-turn conversations and per-example context messages. CSV can't represent a multi-turn example, so those are skipped and reported in the summary. Existing files prompt before being overwritten; `--yes` skips the prompt.

## Editing and repairing training data

`data list` gains `e` to edit the selected example in place. Only the first user/assistant turn is editable; every other message is preserved untouched, and the count of preserved turns is shown so a multi-turn example can't be quietly flattened.

`data validate` gains two repair flags:

```bash
nanotune data validate --fix              # remove exact duplicates
nanotune data validate --rewrite-context  # match context messages to config
```

`--fix` only removes examples that are identical across every message. This is deliberately stricter than the duplicate warning, which compares first user messages only: two examples sharing an input but differing in output are real data. `--rewrite-context` fixes examples whose context message has drifted from the current config, and never inserts one where an example didn't have it.

## Config typos are reported

`ConfigSchema` silently dropped unknown keys, so `loraLayers` instead of `numLayers` was discarded with no warning and the default was used instead. Unknown keys are now reported with a suggestion:

```
Warning: unknown key "training.loraLayers" in config.json, ignored. Did you mean "numLayers"?
```

Nested objects are checked too. An invalid `config.json` fails with the offending path and what was wrong with it, instead of the raw Zod issue array serialized as a wall of JSON.

## Other fixes worth flagging

- **`data list --eval` corrupted training data.** Editing a validation example wrote to `train.jsonl` at the same index, overwriting a real training example. Silent and unrecoverable. Fixed.
- **CSV import dropped valid rows and choked on spreadsheet exports.** Header detection matched any first cell *containing* "input" or "output", so a genuine first row was swallowed as a header; detection now requires the exact two column names. A leading UTF-8 BOM is now stripped.
- **Benchmark matching treated distinct answers as equal.** `normalizeText` canonicalized `"`, `'`, and `` ` ``, so a test expecting one quote style passed on any other. Fixed.
- **`llama-server` dying could kill the CLI.** On Node 22 an unhandled rejection from a killed child is fatal, so a server that died mid-run took the whole CLI down. The handler is now attached at spawn, startup races the health check against the child's exit, and a dead-server benchmark run stops, saves partial results, and scores against what actually ran.
- **`nanotune export` progress jumped.** Each sub-step's progress is now mapped onto its slice of the overall export. `data list` pagination steps back from an empty page.
- **`judge.json` and the `--base` cache are now written atomically.** `judge.json` is written to a fresh `0600` temp file and renamed into place; the base-cache sweep only removes files whose owning process is gone, so concurrent exports can't delete each other's work.

## Internals

452 tests total (+213 since 1.6.0). The command layer now has a test harness using `ink-testing-library` and real keypresses. `src/commands/` previously had none, which is why several of the bugs above shipped. `knip` now enforces `exports: "error"`, and dead exports (`runGGUFInference`, `parseLlamaCppStderr`, `updateExample`) were removed rather than kept on the assumption a caller existed.

## Install

```bash
npm install -g @nanocollective/nanotune
```

Source, issues, and the full changelog are at https://github.com/Nano-Collective/nanotune. If something breaks, open an issue with the command, the output, and your OS and we'll sort it out.

Special thanks to @addyCooks, @rohanshrma222, @akramcodez, @yashksaini-coder, @Aryagarg23, and @floze-the-genius. Every one of them is a first-time Nanotune contributor.