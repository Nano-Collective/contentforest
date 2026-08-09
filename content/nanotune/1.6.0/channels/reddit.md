---
product: nanotune
version: "1.6.0"
channel: reddit
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 3895
---

We just shipped Nanotune v1.6.0. The headline is unglamorous and overdue: Nanotune works without a terminal now.

## The bug

Ink (the React-based TUI library we use) enables raw mode as soon as anything in the component tree calls `useInput`. We use `useInput` for keyboard hints all over the place, like the "press any key to exit" frame on `status`, the help bar on `data list`, and so on. That meant raw mode was turned on for every command, including ones that never needed a keypress.

The result: anyone running `nanotune status | tee run.log`, anyone running it inside CI, anyone running it in Docker without `-t`, and anyone redirecting stdin got a 40-line React reconciler stack trace and exit code 1, even for read-only commands. Looking at the issue tracker, this has been the most common "why does this not work" report for the last several releases.

## The fix

A new `src/lib/tty.ts` detects whether a keyboard is available. Every command now branches on that.

For the render-and-exit commands (`status`, `data validate`, `train`, `export`, `benchmark`, `judge test`):

- They render their output and exit on their own when there is no TTY.
- They exit with a non-zero code on failure, so `nanotune train && nanotune export` works and CI can gate on `nanotune data validate`.
- Keyboard hints are suppressed, so captured output is clean.

For the genuinely interactive commands (`init`, `data add`, `data list`, `chat`, `judge configure`), there's a single clear error and a non-zero exit code:

```
`nanotune chat` needs an interactive terminal.
stdin is not a TTY, so it cannot read keypresses. Run it directly in a
terminal rather than through a pipe, a CI job, or with stdin redirected.
```

One nice side effect: we now have `useKeyInput` as a wrapper around Ink's `useInput`, and it is the only sanctioned way to read keys going forward. Calling `useInput` directly reintroduces the crash, so contributors have a single lint-able pattern to follow.

## Other things in 1.6.0

- `nanotune data import --yes` skips the confirmation prompt. CI-friendly imports without a workaround.
- The platform check moved up front. It used to run inside `installLlamaCpp`, so Linux or Intel Mac users hit a confusing `pip install mlx-lm` resolver error during `train` instead of the clear message that already existed. Now `train` and `export` assert supported hardware before doing anything.
- `judge.json` is now written with `0600` permissions. It can hold a literal API key for users who do not use the `${ENV_VAR}` form, and existing configs are tightened on next save.
- `nanotune chat` finally has a docs page. We shipped it as the 1.5.0 headline without a docs page, which several people called out; `docs/commands/chat.md` covers slash commands, all flags, per-turn stats, and chat-template handling.
- The benchmark preset table had a wrong max-tokens column (50/100/150/200 instead of the actual 128/256/512/1024). Fixed.
- The coverage report is honest now. The `c8` `exclude` pointed at `source/app/App.tsx`, a path that has never existed, and spec files were counted as covered source, trivially 100%. The real number is 78.97%, and that is what the badge shows now.

## Internals

- 239 tests total (+16).
- New `src/lib/tty.ts` (raw-mode detection) and `src/lib/platform.ts` (hardware assertion), both pure and unit-tested.
- Dependabot bumps: `ai` 7.0.15, `@ai-sdk/anthropic` 4.0.8, `@ai-sdk/google` 4.0.8, `ink` 7.1.0, `ava` 8.0.1, `c8` 11.0.0, `knip` 6.24.0, `tsx` 4.23.0, `typescript` 6.0.3, `@types/node` 26.x, `@biomejs/biome` 2.5.1.
- Repaired a broken `pnpm-lock.yaml` and several latent toolchain breaks in CI.

## Install

```bash
npm install -g @nanocollective/nanotune
```

Source, changelog, and issues: https://github.com/Nano-Collective/nanotune

If something breaks for you, open an issue with the command, the output, and your OS. We will sort it out.
