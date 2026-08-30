---
product: nanotune
version: "1.7.0"
channel: linkedin
generated_at: "2026-08-30T18:34:36.252Z"
model: "minimax-m3"
char_count: 3074
---

# How nanotune training now survives a Ctrl+C without lying about it

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Nanotune 1.7.0 rewrote how `nanotune train` handles Ctrl+C. The headline change is small ("Ctrl+C stops training gracefully") but the work behind it isn't.

Before this release, hitting Ctrl+C during a training run tore the React tree down while MLX was still writing its checkpoint. The CLI printed "checkpoint saved" optimistically; nothing verified the file on disk actually matched the iteration the message claimed. Sometimes the file was corrupt. Sometimes it was nothing at all. If the trainer happened to be unresponsive to SIGINT, there was no way out of the terminal at all.

Three things changed in 1.7.0.

First, the command now renders with `exitOnCtrlC: false` and handles Ctrl+C inside its own state machine. During training, a single Ctrl+C fires an `AbortController`, which translates to a SIGINT on the trainer subprocess. MLX flushes its checkpoint before exiting. A second Ctrl+C, if the trainer is wedged, calls `process.exit(130)` directly so the user is never trapped. Interrupted runs exit with code 130, the conventional Unix signal exit code, so scripts that gate on exit code keep their semantics.

Second, the stop summary is now honest. It reports the iteration number MLX actually wrote to `adapters.safetensors`, computed from the most recent progress update MLX yielded before SIGINT, using the `save-every` the run actually used (which can be overridden by `--save-every` and is captured into component state at validation time). The earlier bug where `--save-every 50` against a `config.json` with `saveEvery: 25` named an iteration based on the wrong interval is fixed in the same area.

Third, the temp-file-then-rename pattern now protects `judge.json` and the base-model GGUF cache. `saveJudgeConfig` writes to a `<path>.tmp` with `O_EXCL|O_CREAT` and mode `0o600`, then `renameSync`s the temp over the target. `rename(2)` is atomic and carries the mode with it, so the API key is never present in a file that isn't already `0600`, and an interrupted write cannot leave a truncated `judge.json` behind. The stale-temp cleanup at the top of the function means a previous process that died between write and rename does not leave subsequent saves stuck with `EEXIST`.

The same pattern, with a `<pid>` in the filename, protects concurrent `benchmark --base` runs from each other. The cache sweep at the start of each run only deletes `.tmp-<pid>.gguf` files whose owning pid is gone.

The relevant code lives in `src/commands/train.tsx` (signal handling, UI states), `src/lib/mlx.ts` (abort-to-SIGINT bridge, stop classifier), `src/lib/judge.ts` (atomic `judge.json` write), and `src/lib/model-cache.ts` (the cache sweep). Specs cover the failure cases in `src/lib/mlx.spec.ts` and `src/lib/judge.spec.ts`.

Full release notes and source: [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune).
