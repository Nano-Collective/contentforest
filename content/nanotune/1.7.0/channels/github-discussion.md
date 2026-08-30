---
product: nanotune
version: "1.7.0"
channel: github-discussion
title: "Nanotune v1.7.0: benchmarks are reproducible, chat streams, training is flag-driven"
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 100
---

# Nanotune v1.7.0: benchmarks are reproducible, chat streams, training is flag-driven

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

v1.7.0 is the largest Nanotune release since 1.0. It lands in three areas that came up again and again in issues: the trustworthiness of benchmark numbers, the responsiveness of `nanotune chat`, and the friction of editing `config.json` by hand to tune a run. Every change below ships in this version, on `npm`, today.

## Benchmarks are reproducible by default

Up to 1.6.x, `nanotune benchmark` defaulted to `temperature: 0.8` with no seed and a single sample per test. Running the same suite twice against the same model produced different pass rates. For a tool whose output is a score, every number was ambiguous: a 3-point move could be a real regression, or just sampling noise.

Benchmarks now default to `temperature: 0` with a fixed seed of `42`. Two consecutive runs with default flags produce identical results. If you want the old sampling behaviour, it is one flag:

```bash
nanotune benchmark --temperature 0.8
```

**Existing numbers will move.** Scores recorded before this release were sampled at temperature 0.8; re-running the same suite will produce a different, and from now on stable, figure. Re-baseline any pass rates you are tracking.

### `--samples <n>`

A new flag runs each test `n` times and records the per-test pass rate and variance in both reports, instead of reporting a single coin flip:

```bash
nanotune benchmark --temperature 0.8 --samples 5
```

A test passes when the majority of its samples pass. Each sample uses `seed + sample_index`, so runs stay reproducible while the samples differ from one another.

`--temperature`, `--seed`, and `--samples` now reject a value they cannot parse instead of falling back to the default. `--samples 5x` used to run a single sample; it now fails with a message naming the flag, so a score is never reported under settings you did not ask for.

### `nanotune benchmark compare`

A score on its own does not tell you whether fine-tuning helped. `compare` diffs two saved runs and reports what moved, per test and per category:

```bash
nanotune benchmark compare                      # the two most recent runs
nanotune benchmark compare before.json after.json
```

With one argument, it compares that run against the latest. With none, it picks the two most recent.

### `nanotune benchmark --base`

Benchmarks the base model, before any fine-tuning, as a control. This is the number your fine-tuned score is only meaningful against:

```bash
nanotune benchmark --base
nanotune benchmark
nanotune benchmark compare
```

The base model has to be downloaded, converted, and quantized before it can be benchmarked, which is slow. The result is cached under `~/.nanotune/models/base-cache/`, keyed by model id and quantization, so every project fine-tuning from the same base model pays that cost once. The cache is written to a temp file and renamed into place, so a run killed mid-quantize cannot leave a corrupt GGUF that later runs treat as valid.

Saved reports record whether the run was a base-model control, along with the temperature, seed, and sample count used.

## Chat streams as it generates

`nanotune chat` waited for the entire reply before printing anything, so a long answer looked like a hung terminal. Tokens now stream in over SSE as the model produces them.

Press `Esc` to cancel a generation in flight. Whatever had been generated is kept and stays in the conversation history, so the transcript on screen and the history the model sees never disagree. Cancelling a turn that produced nothing rolls it back entirely.

### `/save` and `/keep`

The best training examples tend to surface during a chat, and there was no way to capture them without retyping into `data add`.

```
/save [file]   Save the transcript to JSON (--force overwrites)
/keep          Append the last exchange to train.jsonl
```

`/save` writes to `.nanotune/chats/` by default and refuses to overwrite an existing file unless you pass `--force`, since a transcript cannot be recovered once it is gone.

## Training hyperparameters are settable from the CLI

Tuning a run meant hand-editing `config.json`. Every training hyperparameter now has a flag:

```bash
nanotune train --batch-size 8 --num-layers 8 --lora-rank 16 --lora-alpha 32
```

New flags: `--batch-size`, `--num-layers`, `--steps-per-eval`, `--save-every`, `--fine-tune-type` (`lora`, `dora`, or `full`), `--lora-rank`, `--lora-alpha`, `--lora-dropout`, `--max-seq-length`, `--grad-checkpoint` / `--no-grad-checkpoint`, `--val-batches`, and `--train-seed`.

Flags override `config.json`; anything you do not pass keeps its configured value. Values are validated against the config schema before the run starts, so a bad number fails immediately with a message naming the flag you typed rather than dying inside `mlx_lm` minutes later. `--fine-tune-type full` skips the LoRA parameter block entirely.

### Ctrl+C stops training gracefully

Ctrl+C used to tear the app down while MLX was still writing, and the "checkpoint saved" hint it printed was never verified. Training now stops on a signal, MLX flushes its checkpoint, and the summary reports the actual last-saved iteration and how to resume:

```
Checkpoint saved at iteration 100
Resume with: nanotune train --resume
```

A second Ctrl+C gives up on the checkpoint rather than trapping you behind a trainer that will not exit. Interrupted runs exit `130`.

### The train/validation split is visible

`ensureValidationSet()` silently moved ~10% of `train.jsonl` into `valid.jsonl` on the first run, so the training-example count dropped with no explanation. The split is now reported when it happens, and both counts are shown on every run.

`--seed <n>` makes the split reproducible. Because the split only happens when no validation set exists yet, passing a seed to an already-split project now says so instead of letting you believe the split was re-rolled.

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

## `nanotune data export`

Exports training data to JSONL, CSV, or JSON, chosen by the output file's extension:

```bash
nanotune data export backup.jsonl
```

JSONL and JSON round-trip exactly: re-importing the output reproduces the original data, including multi-turn conversations and per-example context messages. CSV cannot represent a multi-turn example, so those are skipped rather than silently truncated, and reported in the summary. Existing files prompt before being overwritten; `--yes` skips the prompt for scripts and CI.

## Editing and repairing training data

`data list` gains `e` to edit the selected example in place. Only the first user/assistant turn is editable; every other message is preserved untouched, and the count of preserved turns is shown so a multi-turn example cannot be quietly flattened.

`data validate` gains two repair flags:

```bash
nanotune data validate --fix              # remove exact duplicates
nanotune data validate --rewrite-context  # match context messages to config
```

`--fix` only removes examples that are identical across every message. This is deliberately stricter than the duplicate warning, which compares first user messages only: two examples sharing an input but differing in output are real data. `--rewrite-context` fixes examples whose context message has drifted from the current config, and never inserts one where an example did not have it. When both are passed, the rewrite runs first so examples that only become identical after normalization are still caught.

## Config typos are reported

`ConfigSchema` silently dropped unknown keys, so `loraLayers` instead of `numLayers` was discarded with no warning and the default used instead. Unknown keys are now reported with a suggestion:

```
Warning: unknown key "training.loraLayers" in config.json, ignored. Did you mean "numLayers"?
```

Nested objects are checked too. An invalid `config.json` now fails with the offending path and what was wrong with it, instead of the raw Zod issue array serialized as a wall of JSON.

## Fixes

- **`data list --eval` corrupted training data.** Editing a validation example wrote to `train.jsonl` at the same index, overwriting a real training example and then displaying training data in the validation view. Silent and unrecoverable.
- **CSV import dropped valid rows.** Header detection matched any first cell *containing* "input" or "output", so a genuine first row like `"explain the input parameter","..."` was swallowed as a header. Detection now requires the row to be exactly the two column names.
- **CSV import choked on spreadsheet exports.** A leading UTF-8 BOM, which Excel and Numbers both write, was parsed as part of the first field. It is now stripped.
- **Benchmark matching treated distinct answers as equal.** `normalizeText` canonicalized `"`, `'`, and `` ` `` to a single character, so a test expecting one quote style passed on any other. Quote characters are now kept distinct.
- **`llama-server` dying could kill the CLI.** On Node 22 an unhandled rejection from a killed child process is fatal, so a server that died mid-run took the whole CLI down with a raw stack dump. The handler is now attached at spawn.
- **A bad GGUF reported a timeout instead of the real error.** Startup now races the health check against the child's exit.
- **A benchmark run whose server died scored as a catastrophic regression.** The run now stops at the failure, saves partial results, scores against what actually ran, and says why.
- **`nanotune export` progress jumped.** Each sub-step's progress is now mapped onto its slice of the overall export.
- **`data list` stranded you on an empty page.** Pagination now steps back.
- **`judge.json` could briefly exist with loose permissions.** It is now written to a fresh `0600` temp file and renamed into place, which is atomic and carries the mode with it.
- **`train --save-every` was ignored in the stop summary.** The last-checkpoint iteration was computed from `config.json` rather than the value the run actually used; it now reports what was actually saved.
- **`Object.prototype` keys were not reported as unknown config keys.** A key like `constructor` in `config.json` passed the known-key check via the prototype chain.
- **Concurrent `--base` runs could delete each other's work.** The stale-artifact sweep removed every `.tmp-*.gguf` in the cache directory, including one belonging to a running export. It now only sweeps files whose owning process is gone.
- **The published package shipped more than it needed to.** The `files` allowlist was trimmed, and spec files are excluded from `dist`.

## Documentation

- New pages and sections for `benchmark compare`, `benchmark --base`, `data export`, chat streaming, `/save` and `/keep`, the training hyperparameter flags, and the `--eval` flag across the data commands.
- New `docs/testing-guide.md` covering the Ink component test harness.
- Benchmarking guide documents reproducibility, sampling, and base-model comparison.
- Clarified why `judge.json` needs both a file mode and an explicit `chmod`.

## Internals

- **The command layer has tests.** `src/commands/` previously had no test harness, which is why several of the bugs above shipped. Commands are now rendered through `ink-testing-library` and driven with real keypresses.
- `knip` now enforces `exports: "error"`. Dead exports (`runGGUFInference`, `parseLlamaCppStderr`, `updateExample`) were removed rather than kept on the assumption a caller existed.
- Logic continues to move out of `.tsx` and into testable helpers: `benchmark-compare.ts`, `benchmark-utils.ts`, `model-cache.ts`, `chat-helpers.ts`, plus `buildTrainingArgs`, `mergeEditedTurn`, `clampPagination`, and `scaleProgress`.
- **452 tests total (+213).**

## Toolchain

- Dependency updates via Dependabot: `ai` 7.0.77, `@ai-sdk/anthropic` 4.0.36, `commander` 15.0.0, `execa` 10.0.1, `typescript` 7.0.2, `c8` 12.0.0, `@biomejs/biome` 2.5.7, `@types/node` 26.2.0, `react` and `@types/react`.
- Restored Biome formatting across the repo, and repinned the config `$schema` to the installed Biome version.

## Install

```bash
npm install -g @nanocollective/nanotune
```

Full source, issues, and the changelog are on the project repo at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune). Every one of this release's contributors is a first-time Nanotune contributor; thank you to @addyCooks, @rohanshrma222, @akramcodez, @yashksaini-coder, @Aryagarg23, and @floze-the-genius.