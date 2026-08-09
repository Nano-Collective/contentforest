---
product: nanotune
version: "1.6.0"
channel: github-discussion
title: "Nanotune v1.6.0: Nanotune works without a terminal"
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 5186
---

# Nanotune v1.6.0: Nanotune works without a terminal

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

This release is the smallest in a while and the one most people will feel. Up to 1.5.x, every Nanotune command crashed when `stdin` was not a TTY. That included commands that never needed a keypress, like `status`. A 40-line React reconciler stack trace, exit code 1, no output. v1.6.0 fixes the underlying assumption and makes every command usable from CI, pipes, Docker (without `-t`), and shell scripts.

## Pipe, redirect, and CI without a terminal

Ink enables raw mode as soon as a component calls `useInput`. Nanotune was calling `useInput` for keyboard hints across the whole TUI, which meant raw mode was turned on for every command, including ones that did not need it. Piping `nanotune status` into `tee run.log`, or running it inside a CI step, has always produced something like:

```
ERROR Raw mode is not supported on the target process.
```

The fix is in `src/lib/tty.ts`. Every command now detects whether a keyboard is available and behaves accordingly.

### Render-and-exit commands

`status`, `data validate`, `train`, `export`, `benchmark`, and `judge test` render their output and exit on their own when there is no TTY, instead of parking on a "press any key" frame forever.

Two important consequences:

- **Non-zero exit codes on failure.** A failed run now sets exit code 1, so `nanotune train && nanotune export` chains correctly and CI can gate on `nanotune data validate`.
- **Keyboard hints are suppressed.** Captured output is clean.

A pipeline like this now works end to end:

```bash
nanotune data validate && nanotune train && nanotune export
```

### Interactive-only commands

`init`, `data add`, `data list`, `chat`, and `judge configure` genuinely need a keyboard. They now print a single clear sentence and exit 1, instead of crashing:

```
`nanotune chat` needs an interactive terminal.
stdin is not a TTY, so it cannot read keypresses. Run it directly in a
terminal rather than through a pipe, a CI job, or with stdin redirected.
```

Pairing the diagnostic with a non-zero exit code means CI jobs catch the misuse rather than carrying on.

## `nanotune data import --yes`

New `-y, --yes` flag skips the confirmation prompt, making `data import` usable from scripts and CI:

```bash
nanotune data import examples.jsonl --yes
```

Without a TTY and without `--yes`, the command explains that the flag is required rather than failing obscurely.

## Fixes

- **Platform check now fires up front.** The Apple Silicon assertion only ran inside `installLlamaCpp`, so users on Linux or Intel Macs hit a confusing `pip install mlx-lm` resolver error during `train` instead of the clear message that already existed. `train` and `export` now assert supported hardware before doing any work. Extracted to `src/lib/platform.ts`.
- **`judge.json` is written with `0600` permissions.** The file can hold a literal API key for users who do not use the `${ENV_VAR}` form. Existing configs written by earlier versions are tightened on next save.

## Documentation

- **`nanotune chat` is documented.** The 1.5.0 headline feature shipped with no docs page. Added `docs/commands/chat.md` covering slash commands, all flags, per-turn stats, and chat-template handling, and listed it in the commands index.
- **Quick start covers `chat`** as step 5, between export and benchmark.
- **`data import --yes` documented** in the data command reference.
- **Fixed the benchmark preset table**, where the max-tokens column read 50/100/150/200 instead of the actual 128/256/512/1024.

## Internals

- **Coverage now reports an honest number.** The `c8` `exclude` pointed at `source/app/App.tsx`, a path that has never existed, and spec files were counted as covered source, trivially 100%. Excluding them moves the reported figure from 88.62% to 78.97% with no change in actual test coverage. The point of the bump is honesty, not aesthetics.
- New `src/lib/tty.ts` (raw-mode detection) and `src/lib/platform.ts` (hardware assertion), both pure and unit-tested.
- New `useKeyInput`, `useAutoExit`, and `ExitHint` in `src/components/`. `useKeyInput` is now the only sanctioned way to read keys. Calling Ink's `useInput` directly reintroduces the crash.
- **239 tests total (+16)** covering raw-mode detection, platform assertions, and judge config file permissions.

## Toolchain

- Dependency updates via Dependabot: `ai` 7.0.15, `@ai-sdk/anthropic` 4.0.8, `@ai-sdk/google` 4.0.8, `ink` 7.1.0, `ava` 8.0.1, `c8` 11.0.0, `knip` 6.24.0, `tsx` 4.23.0, `typescript` 6.0.3, `@types/node` 26.x, `@biomejs/biome` 2.5.1.
- Repaired a broken `pnpm-lock.yaml` and several latent toolchain breaks in CI.
- Resolved Biome config deprecations and Semgrep findings.

## Install

```bash
npm install -g @nanocollective/nanotune
```

Full source, issues, and the changelog are on the project repo at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune). If something breaks, open an issue with the command, the output, and your OS, and we will sort it out.
