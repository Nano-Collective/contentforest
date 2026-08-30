---
product: nanotune
version: "1.7.0"
channel: github-discussion
title: "How nanotune training now survives a Ctrl+C without lying about it"
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 15152
---

# How nanotune training now survives a Ctrl+C without lying about it

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

The headline for v1.7.0 says "Ctrl+C stops training gracefully." This article is what is behind that sentence. It is a look at the signal-handling rewrite in `nanotune train`, at the temp-file-then-rename pattern that now protects `judge.json` and the base-model cache, and at what the new exit code, second-Ctrl-C semantics, and `--resume` summary actually do for someone in the middle of a long run.

The TL;DR up front: an interrupted training run no longer pretends to have saved a checkpoint that does not exist, never leaves a corrupt config file in its wake, and gives the user an out if the trainer is in a state it will not leave by itself.

## What Ctrl+C used to do

Before 1.7.0, the `train` command rendered through Ink with the default `exitOnCtrlC: true`. The behaviour that fell out of that was bad in two distinct ways, and both came up enough in issues to be worth fixing properly.

The first problem was timing. Ink tore the React tree down the moment Ctrl+C arrived. MLX, the underlying trainer, was still in the middle of writing a checkpoint when that happened. The trainer's response to a mid-write tear-down was not specified, and in practice it was sometimes a corrupt `adapters.safetensors` file and sometimes nothing at all. The CLI was already printing "checkpoint saved" by the time the user pressed Ctrl+C, because the message was emitted optimistically; nothing in the path actually verified that the file on disk matched the iteration the message claimed.

The second problem was escape. If the trainer happened to be in a state where MLX was not responsive to SIGINT (or had already handled it and was waiting for something else), there was no way to leave. The terminal looked frozen. Killing the terminal from another window worked, but that is a poor answer for someone who just wanted to stop a training run.

The fix is in `src/commands/train.tsx`. The command now renders with `exitOnCtrlC: false`, and the keypress that used to escape to Ink is handled inside the command itself, with two distinct behaviours depending on what state the run is in.

## The new Ctrl+C state machine

There are three states to keep straight, and the behaviour of Ctrl+C differs in each.

**Training.** A single Ctrl+C triggers an abort on the `AbortController` that `train.tsx` set up before the first frame of training. That controller is passed into `runTraining` in `src/lib/mlx.ts` as a `signal` option. The library attaches an `abort` listener that calls `subprocess.kill('SIGINT')`, so MLX receives the same signal it would have received from the terminal. MLX's response to SIGINT is to flush its checkpoint before exiting, and we rely on that.

Once the abort fires, the command's status moves from `training` to `stopping`. The spinner reads `Stopping training (last checkpoint: iteration N)...` where `N` is computed from `Math.floor(progress.iteration / saveEvery) * saveEvery`, using the save-every the run actually used (not whatever is in `config.json`, which may have been overridden by `--save-every`). The summary also handles the awkward case where Ctrl+C arrived before the first checkpoint interval: it tells you so rather than naming an iteration number that has no file behind it.

**Stopping.** This is the second-Ctrl-C behaviour. If the trainer is in `stopping` and another Ctrl+C arrives, the command calls `process.exit(130)` directly. The trainer is given one chance to flush its checkpoint; if that has not happened within the time the user is willing to wait, the user can leave. This is the answer to the "my trainer is wedged and I cannot exit it" failure mode.

**Anything else.** When the status is `done`, `stopped`, or `error`, Ctrl+C falls through to Ink's `exit()` and the process exits cleanly. This is the "press any key to exit" behaviour on the final frame, and Ctrl+C counts as any key.

The choice of `130` as the exit code for an interrupted run is deliberate. `130` is the conventional Unix signal exit code (128 + SIGINT's 2), and it is what shells and CI scripts already know to recognise as a signal-killed process rather than a successful run or a real failure. Scripts that gate on exit code keep their semantics: `nanotune train && nanotune export` does not run the export after an interrupted training, which is what you want.

## What `shouldTreatAsStop` is for

Inside `runTraining`, the for-await over the trainer's stdout can throw `AbortError` if the process exits mid-stream, and `await subprocess` will reject with whatever execa surfaces when its child was killed. Both look, on the surface, like training failures. They are not. They are consequences of the stop we asked for.

`shouldTreatAsStop` in `src/lib/mlx.ts` is a one-line predicate:

```typescript
return signal?.aborted === true;
```

It is deliberately not inspecting the thrown error itself. The reasoning is in the source comment: once we have sent SIGINT, whatever surfaces (an ExecaError, an aborted stream, a stdout that closed early) is a consequence of the stop we asked for. The error is not the signal; the aborted signal is. If the trainer is aborted, the run returns normally from `runTraining`, and the caller in `train.tsx` sets status to `stopped` based on `controller.signal.aborted`. Real failures (an NaN learning rate reaching MLX, a Python import error, a quantization crash) still surface as exceptions and are reported in the `error` branch.

The split is small but it matters: the same execa-level error needs to be classified correctly depending on whether anyone asked for the stop or not. Inspecting the error message to do that classification would be brittle; inspecting the signal we control is robust.

## The `--resume` summary is now honest

The stop summary reports two things and only two things: the actual iteration number of the last checkpoint MLX wrote, and the exact command to resume from it.

```
Checkpoint saved at iteration 100
Resume with: nanotune train --resume
```

The iteration number comes from the same `Math.floor(progress.iteration / saveEvery) * saveEvery` calculation, applied to the most recent progress update the trainer yielded before SIGINT arrived. It is the iteration number MLX actually wrote to `adapters.safetensors`, not the iteration number the spinner was showing when Ctrl+C was pressed (which is usually ahead of the last save, by however many iterations had happened since the last save-every tick).

There was a separate bug, fixed in the same area, where the stop summary was reading `saveEvery` out of `config.training.saveEvery` rather than from the value the run actually used. If you passed `--save-every 50` and your `config.json` had `saveEvery: 25`, the summary would name an iteration based on the wrong interval. Now `train.tsx` captures `training.saveEvery` into component state when validation succeeds and uses that everywhere a save interval appears in the UI.

If Ctrl+C arrived before the first save interval completed, the summary says so: `No checkpoint saved (stopped before iteration N)`. That is the right answer, because `--resume` would fail anyway - `train.tsx` checks for `adapters.safetensors` before letting the run start and fails fast with a clear message if it is missing.

## `judge.json` and the temp-file-then-rename pattern

The signal-handling rewrite is only half the story. The other half is what happens to files on disk when the process dies mid-write. The same pattern shows up in three places in the v1.7.0 source: `saveJudgeConfig` in `src/lib/judge.ts`, the base-model cache write in `src/commands/benchmark.tsx`, and the LoRA config YAML written by `runTraining`. The pattern is the same in all three: write to a temp path, then `renameSync` the temp path over the target.

`saveJudgeConfig` is the most security-sensitive of the three. `judge.json` can hold an API key. Before 1.7.0, it was written with `writeFileSync(path, ...)` and then followed up by an explicit `chmod(path, 0o600)`. The window where the key was on disk at the wrong mode was small, but it was there, and it could be wider than expected if the write itself was interrupted - the chmod would never run.

The new implementation:

```typescript
const tmp = `${path}.tmp`;
rmSync(tmp, {force: true});
writeFileSync(tmp, JSON.stringify(config, null, 2), {
    mode: 0o600,
    flag: 'wx',
});
renameSync(tmp, path);
```

Three details are worth flagging.

**`mode: 0o600` with `flag: 'wx'`.** `wx` is `O_CREAT|O_EXCL`; it requires the temp file to not exist. That is what makes `open(2)` honour the `mode` argument - the kernel only applies the mode on the initial create, and `O_EXCL` is what guarantees that create happens here and nowhere else. Without `O_EXCL`, a pre-existing file at the same path would be truncated and reused at whatever mode it already had, and the `0600` would be silently ignored.

**The stale-temp cleanup.** The `rmSync(tmp, {force: true})` at the top handles the case where a previous process died between the write and the rename. Without it, the `wx` would fail with `EEXIST` forever, and the user would be stuck unable to save judge config until they manually deleted the leftover `.tmp` file. The behaviour is covered by `judge.spec.ts`: a stale temp left behind by a hypothetical killed process is cleaned up and the next save succeeds, and the mode at the final path is `0600`.

**`renameSync` is atomic.** `rename(2)` is one of the few filesystem operations that is guaranteed to be atomic on Unix, which means `judge.json` is never present in a state that is neither the old contents nor the new contents. An interrupted `writeFileSync` followed by an interrupted `chmod` was not atomic and could leave the file truncated, with the old mode, mid-rewrite. The new pattern cannot: either the rename happened and the new file is in place at `0600`, or it did not and the old file is still in place untouched.

The same pattern, with different filenames, applies to the base-model cache in `src/commands/benchmark.tsx`. A `benchmark --base` run exports the GGUF to `cachePath.tmp-<pid>.gguf` and then renames it over the final cache path. The `pid` in the name is what makes it safe for two concurrent `--base` runs against the same base model to share the directory without stepping on each other; the sweep that runs at the start of each export only deletes `.tmp-<pid>.gguf` files whose owning pid is gone (verified by `kill(pid, 0)`), so a running concurrent export never has its in-progress GGUF pulled out from under it.

And the LoRA config YAML that `runTraining` writes for `--fine-tune-type lora` or `dora` goes to a `mkdtempSync` directory under `os.tmpdir()` and is cleaned up in the same function's `finally` block, so the temp never outlives the run.

## What the user sees, end to end

A user in the middle of a training run, on a 1000-iteration config with `--save-every 25`, presses Ctrl+C at iteration 137. The trainer flushes, MLX writes `adapters.safetensors` containing the checkpoint at iteration 125, and the trainer exits. The CLI sees the abort, moves to `stopping`, then to `stopped`:

```
Training stopped

Checkpoint saved at iteration 125
Resume with: nanotune train --resume

Press any key to exit
```

The shell sees exit code 130. The user types `nanotune train --resume`, and the run picks up from iteration 125. The `--resume` path was added in v1.4.0; the v1.7.0 work is making sure that what `--resume` actually resumes from is a real file, named with a real iteration number.

If the trainer happens to be wedged and the first Ctrl+C did not produce the spinner transition, a second Ctrl+C fires `process.exit(130)` directly. The user is unblocked. The checkpoint may or may not exist on disk; if it does, `--resume` picks it up, and if it does not, `--resume` fails fast with `Cannot --resume: no checkpoint found. Run nanotune train without --resume first.`, which is exactly what should happen.

## What is still being honest about

The signal-handling work in v1.7.0 makes a real claim: the iteration number in the stop summary is the iteration number MLX actually wrote, and the resume target is a real file. There are still things the code does not promise.

The stop summary is computed from the most recent progress update MLX yielded before SIGINT. MLX yields progress once per iteration, so the most recent update is iteration 136 in our example. The actual checkpoint is iteration 125 because that is when MLX last flushed. The calculation `Math.floor(136 / 25) * 25` gives 125, which is correct, but only because MLX yields every iteration. If a future change to MLX or to `runTraining`'s parser ever batches yields, the floor calculation would name a checkpoint iteration that does not exist. The honest thing to do if that ever happens is to have MLX tell us which iteration it last wrote, not to assume the yield cadence matches the save cadence.

The second-Ctrl-C behaviour is an escape hatch, not a guarantee. Calling `process.exit(130)` skips the trainer's checkpoint flush. There is a real scenario where the first Ctrl+C produced a wedged state because MLX was mid-flush, and the second Ctrl+C arrives before the flush completed. The user gets out, but the partial file is on disk and the resume target may not exist. The `finally` block in the temp-file writes handles their own temp files; the trainer's checkpoint is owned by MLX. The right fix is upstream in MLX, not in `nanotune`.

And `shouldTreatAsStop` deliberately ignores the thrown error. If MLX happens to throw an error that is unrelated to the SIGINT we just sent (the trainer crash happened to coincide with the signal, for instance), `shouldTreatAsStop` reports the run as a clean stop rather than the crash it actually was. In practice the signal-to-error coincidence is rare enough to be a non-issue, but it is a real edge case.

## Where the rest of the source lives

The signal handling is in two files:

- `src/commands/train.tsx` for the keypress wiring and the UI states.
- `src/lib/mlx.ts` for the abort-to-SIGINT bridge (`stopOnAbort`, `abortTraining`) and the stop/failure classifier (`shouldTreatAsStop`).

The atomic-write pattern lives in three:

- `src/lib/judge.ts` (`saveJudgeConfig`) for the API key.
- `src/commands/benchmark.tsx` (the cache write) for the base-model GGUF.
- `src/lib/mlx.ts` (`runTraining`) for the LoRA config YAML.

The stale-temp sweep for the cache directory is in `src/lib/model-cache.ts` (`sweepStaleCacheArtifacts`).

If the signal-handling rewrite on a single training run surfaces a case this article does not cover, the relevant tests to look at are `src/lib/mlx.spec.ts` (for `stopOnAbort`, `abortTraining`, and `shouldTreatAsStop`) and `src/lib/judge.spec.ts` (for the temp-then-rename pattern). Both have spec coverage for the cases that motivated the rewrite.

Source, issues, and the full v1.7.0 changelog are at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune).
