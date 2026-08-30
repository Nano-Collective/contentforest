---
product: nanotune
version: "1.7.0"
channel: github-discussion
title: "Re-baselining your nanotune project after v1.7.0"
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 14074
---

# Re-baselining your nanotune project after v1.7.0

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

The headline for v1.7.0 is that benchmarks are now reproducible by default: temperature `0`, seed `42`, one sample per test, results that match run to run. That's the change. This article is the part that follows from it: how to rebuild a baseline you can actually trust, how to pick between `--base`, a plain run, and `compare`, and how to keep the numbers you've already recorded meaningful instead of just historical noise.

If you have a Nanotune project from before v1.7.0, this is the read you want before you touch anything. If you're starting fresh, the same workflow applies from day one; just skip the re-baselining step.

## Why your existing numbers are about to move

Up to 1.6.x, `nanotune benchmark` ran with `temperature: 0.8`, no fixed seed, and a single sample per test. That means the score you saved was one coin flip out of an unknown number of possible flips. A 3-point drop between two adjacent runs might be a regression. It might also be: Tuesday.

The new defaults are `temperature: 0` and `seed: 42`. Two consecutive runs with default flags produce identical output. That's what you want from a benchmark. But it also means every score you recorded before v1.7.0 was drawn from a different distribution than the ones you'll record now, and the absolute numbers will not line up. This is a feature, not a regression, but it does mean the old numbers cannot be averaged with the new ones. They are not the same kind of measurement.

Three things follow from that, and they shape everything below:

1. Your old saved reports stay valid as historical artefacts. Do not delete them. They tell you what the model was doing under the old sampling regime, which is its own kind of useful record.
2. Your new "current score" needs a clean re-baseline. The first thing you do after upgrading is run the suite once with default flags and save the report. That is your anchor from now on.
3. Cross-run comparisons only make sense within a regime. Two v1.7.0 runs against the same model are comparable. A v1.6.x report and a v1.7.0 report against the same model are not, even if both files are sitting in `.nanotune/benchmarks/`.

## The three commands and when to reach for each

The v1.7.0 benchmark surface is three commands, and they answer three different questions. Picking the wrong one is the most common way practitioners end up with misleading numbers.

### `nanotune benchmark`

A score on a model. That's it. You run this when you want to know what your fine-tuned model is doing right now, against the test suite, with the current defaults. The report is a single point in time: pass count, pass rate, per-test breakdown, timing metrics. Saved as JSON and Markdown in `.nanotune/benchmarks/`.

This is what you run most of the time. It is the "what is my model doing today" question.

### `nanotune benchmark --base`

The same suite, against the base model before any fine-tuning. This is a control. It is the number your fine-tuned score is only meaningful against: a fine-tuned model that scores 70% on a suite where the base scored 65% is doing something; the same 70% against a base of 40% is doing a lot more.

`--base` is slower the first time. The base model has to be downloaded, converted to GGUF, and quantized before it can run. The result is cached under `~/.nanotune/models/base-cache/`, keyed by model id and quantization, so every project fine-tuning from the same base model pays that cost once. The cache is written to a temp file and renamed into place, so a run killed mid-quantize cannot leave a corrupt GGUF that later runs treat as valid.

Run `--base` once per base model, not per training run. The base does not change between fine-tuning iterations. If you change base models, you re-run `--base`. If you only change training data or hyperparameters on the same base, your cached base run is still valid.

A base-model run is tagged in the saved report, so it is unambiguous later which runs were controls and which were fine-tuned evaluations.

### `nanotune benchmark compare`

The diff between two saved runs. Per-test pass/fail flips, per-category deltas, overall delta. This is the "did fine-tuning help" question.

```bash
nanotune benchmark compare                      # the two most recent runs
nanotune benchmark compare before.json after.json
```

With no arguments, it picks the two most recent saved reports by mtime. With one argument, it compares that run against the latest other run (falling back to the second-latest if your named file is itself the latest). With two arguments, the first is treated as before, the second as after, regardless of which is newer on disk.

`compare` matches tests by id, not by index. If your `tests.json` changed between the two runs, ids present in only one run are reported separately rather than being silently skipped. If the same id has a different prompt in the two runs, that id is treated as dropped-on-one-side and added-on-the-other rather than as a real flip, because the test itself changed.

This is the command you reach for after a training run, not before. It needs at least two saved runs to do anything, and the meaningful pair is almost always "the run I had before this change" versus "the run I have after."

## A re-baselining workflow that survives contact with reality

Here is the order of operations I'd recommend for anyone with an existing Nanotune project who is upgrading to v1.7.0. None of this is novel; it is what falls out of the new defaults once you take them seriously.

### Step 1: keep your old reports, label them

Do not delete the `.nanotune/benchmarks/*.json` files from before the upgrade. They are evidence of what the model was doing under sampling, and you may still want to look at them. If your workflow has any kind of dashboard or notes, add a tag or note that says "pre-v1.7.0 sampling regime" so future-you does not accidentally average them with new runs.

### Step 2: run a clean default benchmark

With the new install, from the project root:

```bash
nanotune benchmark
```

No flags. Default temperature, default seed, default sample count. Save the report. This is your new baseline. Note the timestamp; this is the "from" point for all future comparisons.

If your test suite has not changed, the only difference between this run and your last pre-v1.7.0 run is the temperature and seed. The absolute number will move. That is expected. What matters is that the new number is stable: run it again immediately and it should match to the digit.

### Step 3: run `--base` once

Same suite, against the base model:

```bash
nanotune benchmark --base
```

The first run downloads and quantizes the model, which is slow. After that, every Nanotune project fine-tuning from the same base shares the cache. This run is your control. The pass rate your fine-tuned model hits minus this number is your real signal.

Save the report alongside your fine-tuned baseline. The saved JSON includes `isBase: true` and the temperature/seed/sample count used, so the file is self-describing later.

### Step 4: compare baseline against base

```bash
nanotune benchmark compare <base-report>.json <baseline-report>.json
```

This tells you whether your existing fine-tuned model is doing anything at all relative to its starting point. If the delta is small, that is a finding: maybe you have been fine-tuning on data the model already covers, or maybe the test suite is too easy to discriminate. Either way, you would rather know now than after the next ten training iterations.

### Step 5: from here on, every training run gets two benchmarks

After each training run, save two reports:

1. `nanotune benchmark` against the new fine-tuned model.
2. `nanotune benchmark compare <previous-fine-tuned>.json <this-run>.json`.

Compare against your previous fine-tuned run, not against the base. The base is your floor; the previous fine-tune is your peer. Most of the time, what you care about is whether this change beat the last change. If you find yourself reaching for the base comparison more than occasionally, the question is usually about whether to re-baseline the whole suite, not whether the latest training run helped.

If you also want to know how stable your fine-tuned score is, add sampling:

```bash
nanotune benchmark --temperature 0.8 --samples 5
```

This runs each test five times with different seeds derived from the base seed, reports the pass rate and variance per test, and counts a test as passed when the majority of samples pass. A test that passes 5/5 is a different signal from one that passes 3/5, even though both register as a pass on the overall score. When you see wide variance on a specific test, that test is telling you something about its own prompt, not about your model. It might be underspecified, or it might be at the boundary of what the model can do reliably. Either way, fix the test before you fix the training data.

### Step 6: keep `--samples` low for day-to-day, higher for the boundary cases

A single-sample default run is fast and gives you a binary signal: pass or fail. That is what you want most of the time. Reserve multi-sample runs for tests where you have already noticed the pass rate wobbling, or for the final evaluation of a model before you cut a release. There is no value in paying the five-times inference cost on every iteration if your suite is well-behaved.

## What the new defaults mean for existing CI

If you have a CI pipeline that benchmarks every pull request, the upgrade is almost free: the numbers will move once, on the first run after the upgrade, and from then on they will be stable. That single move is the one thing to communicate, and it is worth a paragraph in your project's upgrade notes so nobody reads the diff as a regression.

Two pipeline details are worth checking:

- If your CI gates merges on a benchmark threshold, that threshold needs to be re-derived from the post-upgrade baseline. The old threshold was measured against the sampling distribution, not the deterministic one, and they are not the same shape.
- If your CI re-uses cached llama-server binaries or quantized base models across runs, the cache is keyed by model id and quantization, so you should not need to invalidate anything. The `--base` cache directory is the same on every machine that fine-tunes from the same base.

## Edge cases worth knowing about

A few things came up enough during v1.7.0 development that they are worth flagging now, so they do not surprise you in the middle of a re-baselining session.

**`--temperature`, `--seed`, `--samples` reject unparseable values.** A typo like `--samples 5x` used to silently run a single sample and report a number under settings you did not ask for. It now fails with a message naming the flag. This is on purpose: a benchmark number has to come from the configuration you actually meant to run.

**A run whose `llama-server` dies saves partial results.** Before 1.7.0, a server crash mid-suite could leave you with a final score that did not reflect what actually ran. The run now stops at the failure, saves what it had, and scores against the tests that completed, with a note explaining why. When you compare against one of these partial reports, the diff is still meaningful; you just want to read the note first.

**The published package ships less than it used to.** Spec files are excluded from `dist` and the `files` allowlist was trimmed. If your tooling depended on pulling test fixtures from the installed package, that is no longer the contract. Source and fixtures live in the repo.

## What this looks like in practice

A typical re-baselining afternoon for an existing project, end to end:

1. `npm install -g @nanocollective/nanotune` (the v1.7.0 release).
2. From the project root, `nanotune benchmark` with no flags. Save the report. Note the new pass rate; it will be different from the last pre-upgrade number, and from now on it will be stable.
3. `nanotune benchmark --base`. First run is slow; subsequent runs hit the cache. Save the report.
4. `nanotune benchmark compare <base>.json <baseline>.json`. The per-category delta tells you where your existing fine-tuning is buying you the most, and where it is not.
5. From here on, every training run ends with a benchmark and a compare against the previous fine-tuned run. Keep the reports; they are how you reconstruct the trajectory later.

The total cost is one slow run (the base) and one fast run (the baseline) per base model. After that, the per-iteration overhead is a single benchmark run and a compare, both of which complete in the time it takes to run the suite once.

## On changing defaults in a tool people rely on

Changing the meaning of "score" in a tool that produces scores is a bigger change than it looks, and we did not do it lightly. The honest argument for it is that the previous defaults were producing numbers that did not mean what most people thought they meant, and the fix was not "add a flag" but "change what the tool reports by default." Anyone who wants the old behaviour can have it with `--temperature 0.8`, and the behaviour is documented, but the default is now the one that survives scrutiny.

If you have a workflow built around the sampling behaviour, the migration path is straightforward: add `--temperature 0.8` to your benchmark invocations and the scores will line up with your historical reports within sampling tolerance. You are not forced to use the new defaults. But if you do switch, do the re-baselining above. Do not try to mix old and new numbers in the same trend line.

The source, the issue tracker, and the full v1.7.0 changelog are at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune). If the re-baselining turns up something the workflow above does not cover, an issue with the report files attached is the fastest way to get it looked at.
