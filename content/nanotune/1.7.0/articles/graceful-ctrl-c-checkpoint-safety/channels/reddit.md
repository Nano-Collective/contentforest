---
product: nanotune
version: "1.7.0"
channel: reddit
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 8453
---

# How nanotune training now survives a Ctrl+C without lying about it

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

This is the post I wanted to write after spending a weekend in the `nanotune train` source. The headline for v1.7.0 says "Ctrl+C stops training gracefully," and I had been assuming that was a small UX tweak. It isn't. It is a real rewrite of how the command handles signals, and once you read `src/commands/train.tsx` and `src/lib/mlx.ts` side by side, the rest of the release falls into place.

Here's the shape of the thing.

## The old behaviour was bad in two ways

The `train` command renders through Ink, and Ink's default is `exitOnCtrlC: true`. Two things fell out of that, and both came up enough in issues to fix properly.

The first was a race. When you hit Ctrl+C, Ink tore the React tree down. MLX, the actual trainer, was in the middle of writing a checkpoint when that happened. Sometimes the file was corrupt; sometimes it was nothing at all. The CLI was already printing "checkpoint saved" by the time you pressed Ctrl+C, because the message was optimistic; nothing actually verified that the file on disk matched the iteration it claimed.

The second was escape. If the trainer happened to be in a state where MLX wasn't responding to SIGINT (or had already handled it and was waiting on something else), there was no way out. Killing the terminal from another window worked, but that's a poor answer for someone who just wanted to stop a run.

## The new state machine

There are three states to keep straight, and the Ctrl+C behaviour differs in each.

**During training.** A single Ctrl+C fires an `AbortController` that the command set up before the first frame of training. That controller is passed into `runTraining` as a `signal` option. The library attaches an `abort` listener that calls `subprocess.kill('SIGINT')`. MLX gets the signal it would have got from the terminal, and its response is to flush its checkpoint before exiting. The command moves from `training` to `stopping`, and the spinner reads `Stopping training (last checkpoint: iteration N)...` where `N` is calculated from `Math.floor(progress.iteration / saveEvery) * saveEvery`.

**During stopping.** A second Ctrl+C calls `process.exit(130)` directly. This is the answer to "my trainer is wedged and I can't leave it." The trainer gets one chance to flush; if it can't, you can.

**Anywhere else.** Once the status is `done`, `stopped`, or `error`, Ctrl+C falls through to Ink's normal `exit()`. Clean exit.

The exit code is `130` deliberately. That's the conventional Unix signal exit code (128 + SIGINT's 2), so scripts that gate on exit code keep their semantics: `nanotune train && nanotune export` does not run the export after an interrupted training, which is the right thing.

## `shouldTreatAsStop` is one line and earns its keep

Inside `runTraining`, the for-await over the trainer's stdout can throw `AbortError`, and `await subprocess` will reject with whatever execa surfaces. Both look like training failures. They're not; they're consequences of the stop we asked for.

`shouldTreatAsStop` in `src/lib/mlx.ts` is:

```typescript
return signal?.aborted === true;
```

It deliberately does not inspect the thrown error. Once we've sent SIGINT, whatever surfaces is a consequence of the stop we asked for. The error is not the signal; the aborted signal is. Real failures (a NaN learning rate, a Python import error, a quantization crash) still surface as exceptions.

## The temp-file-then-rename pattern

The signal handling is only half the story. The other half is what happens to files on disk when the process dies mid-write. The same pattern shows up in three places in v1.7.0.

`saveJudgeConfig` in `src/lib/judge.ts` is the security-sensitive one. `judge.json` can hold an API key. The old code wrote the file and then called `chmod`. If the write was interrupted, the chmod never ran. The new code:

```typescript
const tmp = `${path}.tmp`;
rmSync(tmp, {force: true});
writeFileSync(tmp, JSON.stringify(config, null, 2), {
    mode: 0o600,
    flag: 'wx',
});
renameSync(tmp, path);
```

Three details are worth noting:

1. `mode: 0o600` with `flag: 'wx'`. `wx` is `O_CREAT|O_EXCL`. Without `O_EXCL`, a pre-existing file at that path would be truncated and reused at whatever mode it already had, and the `0600` would be silently ignored. `O_EXCL` is what guarantees the mode is applied on the initial create.

2. The stale-temp cleanup. The `rmSync(tmp, {force: true})` at the top handles the case where a previous process died between write and rename. Without it, the `wx` would fail with `EEXIST` forever. The behaviour is covered by `judge.spec.ts`.

3. `renameSync` is atomic. `judge.json` is never present in a state that is neither the old contents nor the new contents. An interrupted `writeFileSync` followed by an interrupted `chmod` could leave a truncated file at the wrong mode; the new pattern cannot.

The same pattern, with different filenames, applies to the base-model cache in `src/commands/benchmark.tsx` (a `benchmark --base` run writes the GGUF to `cachePath.tmp-<pid>.gguf` and renames it over the final path), and to the LoRA config YAML that `runTraining` writes for `--fine-tune-type lora` or `dora`.

## Two more things worth knowing

The stop summary reports the iteration MLX actually wrote, computed from the same `Math.floor(progress.iteration / saveEvery) * saveEvery` formula. A separate bug, fixed in the same area, had it reading `saveEvery` out of `config.training.saveEvery` instead of the value the run actually used. If you passed `--save-every 50` and your `config.json` had `saveEvery: 25`, the summary would name an iteration based on the wrong interval. Now `train.tsx` captures `training.saveEvery` into component state when validation succeeds and uses that everywhere a save interval appears in the UI.

The cache sweep at the start of each `benchmark --base` run only deletes `.tmp-<pid>.gguf` files whose owning pid is gone (verified by `kill(pid, 0)`). Two concurrent `--base` runs against the same base model share the directory; deleting every `.tmp-*` unconditionally would pull the half-written GGUF out from under a concurrent export mid-quantize. The pid is the safety belt.

## What I still think is worth being honest about

The signal-handling work makes a real claim: the iteration number in the stop summary is the iteration number MLX actually wrote, and the resume target is a real file. There are still things it does not promise.

The summary is computed from the most recent progress update MLX yielded before SIGINT. MLX yields progress once per iteration, so the most recent update is iteration 136 in our example; the actual checkpoint is iteration 125 because that's when MLX last flushed. The calculation `Math.floor(136 / 25) * 25` gives 125, which is correct, but only because MLX yields every iteration. If a future change to MLX or to `runTraining`'s parser ever batches yields, the floor would name a checkpoint iteration that doesn't exist.

The second-Ctrl-C is an escape hatch, not a guarantee. Calling `process.exit(130)` skips the trainer's checkpoint flush. If the first Ctrl+C produced a wedged state because MLX was mid-flush, the second Ctrl+C arriving before the flush completes gives you out, but the partial file is on disk and the resume target may not exist. The right fix is upstream in MLX, not in `nanotune`.

`shouldTreatAsStop` deliberately ignores the thrown error. If MLX happens to throw an error that is unrelated to the SIGINT we just sent, `shouldTreatAsStop` reports the run as a clean stop rather than the crash it actually was. The signal-to-error coincidence is rare, but it is a real edge case.

## If you want to read the code yourself

The signal handling is in `src/commands/train.tsx` (keypress wiring, UI states) and `src/lib/mlx.ts` (abort-to-SIGINT bridge, stop classifier). The atomic-write pattern is in `src/lib/judge.ts`, `src/commands/benchmark.tsx`, and `src/lib/mlx.ts`. The cache sweep is in `src/lib/model-cache.ts`.

The relevant tests are `src/lib/mlx.spec.ts` and `src/lib/judge.spec.ts`. Both have spec coverage for the cases that motivated the rewrite.

Source, issues, and the full v1.7.0 changelog are at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune).
