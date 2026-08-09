---
product: nanotune
version: "1.6.0"
channel: github-discussion
title: "Running Nanotune end to end in CI, scripts, and Docker without a TTY"
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 16341
---

# Running Nanotune end to end in CI, scripts, and Docker without a TTY

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The headline of the v1.6.0 release is that Nanotune works without a terminal. This article is the long version: what the new shape of the CLI looks like under the hood, how to chain commands the way you would chain any other tool from CI, and where the boundaries are between commands that finish on their own and commands that genuinely need a keyboard.

If you have ever piped `nanotune status` into `tee run.log` and watched a 40-line React reconciler stack trace land in your log file, this is the post that explains why that happened, why it does not happen any more, and how to write pipelines against the new shape.

## Why every command used to crash without a TTY

Nanotune is built on Ink, a React-based TUI library. Ink enables raw mode on `process.stdin` as soon as anything in the component tree calls `useInput`. We used `useInput` to wire up "press any key to exit" frames and help bars across the TUI, which sounds harmless until you realise that raw mode is enabled the moment the React tree mounts, not the moment the user presses a key.

If `stdin` is not a TTY, Ink throws:

```
ERROR Raw mode is not supported on the target process.
```

...and then React tries to render a frame anyway, which is where the stack trace comes from. The throw is fast, the stack trace is long, and exit code is 1, so every command looked broken from the outside, including read-only commands that never needed a keypress in the first place. `nanotune status`, `nanotune data validate`, and `nanotune judge test` all paid the same tax.

The fix lives in `src/lib/tty.ts`. The two helpers are deliberately tiny so they are easy to test and impossible to misread:

```ts
export function supportsRawMode(stdin = process.stdin): boolean {
  return stdin.isTTY === true;
}

export function interactiveRequiredMessage(command: string): string {
  return (
    `\`nanotune ${command}\` needs an interactive terminal.\n` +
    'stdin is not a TTY, so it cannot read keypresses. Run it directly in a ' +
    'terminal rather than through a pipe, a CI job, or with stdin redirected.'
  );
}
```

The strict `=== true` check matters. Node leaves `isTTY` as `undefined` (not `false`) on non-TTY streams, so a truthy-but-not-true value would silently let raw mode slip through and reintroduce the crash. The unit test for that case is in `src/lib/tty.spec.ts` and is the guard we rely on.

## The split: render-and-exit vs interactive-only

Every Nanotune command now classifies into one of two buckets, and the bucket determines the behaviour under non-interactive conditions. There is no third mode, and commands do not silently degrade in surprising ways.

### Render-and-exit commands

`status`, `data validate`, `train`, `export`, `benchmark`, and `judge test` render their final output and exit on their own when there is no keyboard. The plumbing for that is two new components:

- `useKeyInput(handler, isActive = true)` is a drop-in for Ink's `useInput` that passes `isActive: false` whenever `supportsRawMode()` returns false. Ink never tries to enable raw mode, so there is nothing to throw.
- `useAutoExit(done, failed)` calls Ink's `exit()` as soon as `done` is true and there is no keyboard to wait on. If `failed` is true, it sets `process.exitCode = 1` first, so shell chains behave correctly.
- `<ExitHint>` is a small component that renders the "Press any key to exit" line only when there is a keyboard to act on. Without one it returns `null`, so captured output is clean.

Concretely, `useAutoExit(true, !hasConfig)` in `status.tsx` and `useAutoExit(status === 'done' || status === 'error', status === 'error')` in `data/import.tsx` are the only places that decide whether to call `exit()`. The status command exits as soon as it has rendered the report. The import command exits as soon as the import resolves. Both surface a real exit code on failure.

### Interactive-only commands

`init`, `data add`, `data list`, `chat`, and `judge configure` genuinely need a keyboard: they prompt, paginate, or run a REPL. There is no honest way to run them without a TTY. v1.6.0 makes that explicit in `src/cli.tsx`:

```ts
function renderInteractive(name: string, node: ReactElement): void {
  if (!supportsRawMode()) {
    console.error(interactiveRequiredMessage(name));
    process.exitCode = 1;
    return;
  }
  render(node);
}
```

If a script accidentally runs `nanotune chat` in CI, it now prints one clear sentence and exits 1 instead of crashing:

```
`nanotune chat` needs an interactive terminal.
stdin is not a TTY, so it cannot read keypresses. Run it directly in a
terminal rather than through a pipe, a CI job, or with stdin redirected.
```

Two consequences worth noting. First, the message is the same wording across every interactive-only command, because it comes from the same helper. Second, the non-zero exit code means a CI job that accidentally invokes one of these fails the step instead of carrying on as if it succeeded. That is the right failure mode for a misuse, and it is the change that makes the split safe to lean on from automation.

## The new `--yes` flag on `data import`

`data import` is the one command in the render-and-exit bucket that, until 1.6.0, needed a keystroke to confirm. It is now flagged explicitly:

```ts
dataCommand
  .command('import <file>')
  .option('-y, --yes', 'Skip the confirmation prompt (for scripts and CI)')
  .action(async (file, options) => {
    if (!options.yes && !supportsRawMode()) {
      console.error(interactiveRequiredMessage('data import'));
      console.error('Pass --yes to import without confirmation.');
      process.exitCode = 1;
      return;
    }
    render(<DataImportCommand file={file} yes={options.yes} />);
  });
```

Three things to take away from the snippet:

- The check happens in the CLI layer, before the React tree mounts. There is no TTY frame that crashes mid-render and no `useEffect` racing the prompt.
- The error wording is the same `interactiveRequiredMessage` helper used elsewhere, with one extra line that points the user at the flag they need.
- The component itself short-circuits past the preview screen when `yes` is true (`status` starts at `'importing'` rather than `'preview'`), so the rendered output is the same on a TTY as it is in a pipe.

`--yes` is a deliberately small flag. It does not change what gets imported. It does not skip validation. It only skips the y/n prompt. If you want the import to be re-validated by `nanotune data validate` afterwards, you still have to run it.

## A full non-interactive pipeline

The simplest useful pipeline is the one the changelog points at: validate, train, export. With the new exit-code semantics on render-and-exit commands, the chain is just `&&`:

```bash
nanotune data validate && nanotune train && nanotune export
```

In CI that might look like:

```yaml
jobs:
  retrain:
    runs-on: macos-14   # Apple Silicon runners; MLX + llama.cpp binaries target arm64
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install -g @nanocollective/nanotune
      - run: nanotune data import data/examples.jsonl --yes
      - run: nanotune data validate
      - run: nanotune train --iterations 200
      - run: nanotune export -q q8_0
      - run: nanotune benchmark --preset medium --timeout 60000
```

A few notes on why each step is shaped that way:

- `data import --yes` is the only data command that would otherwise need a keystroke. The other data commands (`add`, `list`) are interactive-only and should not appear in a non-interactive pipeline.
- `data validate` exits non-zero on duplicate examples, broken alternation, missing fields, or under the minimum example count, so the `&&` chain breaks early and CI fails loudly. This was the practical reason to fix exit codes in 1.6.0; before, `data validate` would have crashed with a stack trace before reporting any problems.
- `train --iterations 200` overrides the configured iteration count at the CLI, which keeps the pipeline reproducible regardless of what is in `config.json` on the runner.
- `export -q q8_0` produces an 8-bit GGUF. The pre-built llama.cpp binaries are downloaded automatically by Nanotune, so the runner does not need a compiler toolchain.
- `benchmark --preset medium --timeout 60000` selects the laptop preset (8 threads, 20 GPU layers, 4096 ctx, 256 max tokens) and gives each test a 60-second ceiling, which avoids a slow generation holding the step open. Benchmark reports land in `benchmarks/` as both JSON and Markdown.

You can drop `data validate` if you trust the input, but it is cheap and gives you a precise error if the JSONL drifts. The validation report covers duplicates, broken turn alternation, missing fields, context-message consistency, and minimum example count.

## Docker without `-t`

The classic Docker failure mode was:

```
$ docker run nanotune:latest nanotune status | tee status.log
ERROR Raw mode is not supported on the target process.
    at ...
    at ...
    ... (40 lines)
```

In 1.6.0 the same command prints a clean status report and exits. A working Dockerfile looks like:

```dockerfile
FROM node:22-bookworm-slim
RUN npm install -g @nanocollective/nanotune
WORKDIR /project
COPY data/ ./data/
COPY nanotune.config.json ./
# NOTE: no USER nanotune, no TTY allocation, no interactive flags needed.
ENTRYPOINT ["nanotune"]
```

Then:

```bash
docker build -t nanotune:latest .
docker run --rm nanotune:latest data validate
docker run --rm nanotune:latest train --iterations 100
docker run --rm nanotune:latest export -q q4_k_m -o model-q4km
```

Notice there is no `-t` flag on `docker run`. There is no `script` wrapper. There is no `unbuffer`. The container does not need an interactive PTY because every command in the chain is a render-and-exit command that finishes on its own.

If you accidentally include `nanotune chat` in the Dockerfile's `CMD`, you will get the single-sentence `interactiveRequiredMessage` and a non-zero exit code. That is the signal to fix the command, not a bug to work around with `-t`.

## cron and systemd timers

cron jobs and systemd timers are the other common non-interactive context. They are simpler than CI because there is no YAML layer, just shell:

```cron
# /etc/cron.d/nanotune-retrain
0 3 * * 1  nanotune  cd /srv/nanotune && nanotune data validate >> /var/log/nanotune.log 2>&1 && nanotune train >> /var/log/nanotune.log 2>&1 && nanotune export >> /var/log/nanotune.log 2>&1
```

Things worth checking on cron specifically:

- `cron` does not allocate a TTY, so `process.stdin.isTTY` is `undefined`. Render-and-exit commands detect that and exit cleanly.
- `MAILTO=""` in the crontab prevents the cron daemon from trying to email the output to the user. With render-and-exit commands the output is meaningful, so the right place for it is a log file (`>> /var/log/nanotune.log 2>&1`).
- If the chain fails, you want the next run to keep going rather than blocking on a stuck `nanotune train`. That was the behaviour under 1.5.x too, but it now works because the command exits on its own instead of hanging on a "press any key" frame.

For systemd, the equivalent `Service` block looks like:

```ini
[Service]
Type=oneshot
User=nanotune
WorkingDirectory=/srv/nanotune
ExecStart=/usr/bin/env bash -c 'nanotune data validate && nanotune train && nanotune export'
StandardOutput=append:/var/log/nanotune.log
StandardError=inherit
```

`StandardOutput=append:` writes to a log file without truncating, which keeps history. `StandardError=inherit` lets systemd route stderr to the journal alongside stdout.

## Things that are deliberately still interactive

It is worth being explicit about what v1.6.0 did not change, because the boundary is part of the design.

`nanotune init` walks you through creating a `nanotune.config.json`, including the project name, base model, training defaults, and the `contextMessage` role. That is a guided setup, not a batch operation. Running it in CI would just produce a half-configured stub.

`nanotune data add` builds examples turn by turn, with a "Add another turn?" prompt and an Esc-to-save escape hatch. The whole flow is a REPL-shaped conversation. We have not shipped a flag that lets you pipe in examples one per line, because the multi-turn shape is hard to express without a real prompt.

`nanotune chat` is the inference REPL. It uses Ink to render streaming tokens and reads slash commands (`/reset`, `/system`, `/stats`, `/help`, `/exit`) from the keyboard. There is no scripted equivalent on purpose; if you want a non-interactive smoke test of an exported model, use `nanotune benchmark` with a tiny dataset instead.

`nanotune data list` is interactive because it paginates a potentially long examples table and lets you delete rows by index. If you need a non-interactive listing, `cat data/train.jsonl` is the right tool.

`nanotune judge configure` writes a `judge.json` that can hold a literal API key, and it walks you through provider and model selection. The key file is now written with `0600` permissions (also new in 1.6.0), but the configuration flow itself is still interactive on purpose.

## What this means for contributors

If you are adding a new command or touching an existing one, there are two rules that keep the non-interactive story intact.

1. Never call Ink's `useInput` directly. Use `useKeyInput` from `src/components/index.ts`. It wraps Ink's `useInput` with a `supportsRawMode()` guard, so the crash cannot recur by accident.
2. Decide the command's bucket explicitly. Render-and-exit commands should call `useAutoExit(done, failed)` and render their keyboard hints through `<ExitHint>`, both of which no-op when there is no keyboard. Interactive-only commands should be wired through the `renderInteractive` helper in `src/cli.tsx`, which prints the standard message and exits 1 on a non-TTY.

If a command is genuinely render-and-exit but you forget the `useAutoExit` call, the command will hang forever on the "Press any key to exit" frame in CI, which is the symptom to look for in a code review. If a command is interactive-only but you accidentally call `render(node)` directly, the test that fails first is the one in `src/lib/tty.spec.ts` that asserts the message wording is plain text (no `at ` and at most three lines).

The other internal change worth knowing: `c8`'s coverage `exclude` previously pointed at `source/app/App.tsx`, a path that has never existed, which let spec files count as covered source and inflated the badge to 88.62%. The new exclude is `src/**/*.spec.ts{,x}` and `dist/**`, which moves the reported figure to a real 78.97%. That is not a bug, but it is the kind of number that surprises people on first read, so: yes, the coverage number went down. The tests did not.

## Putting it together

The shape v1.6.0 leaves you with is roughly: anything that can run without a keyboard runs without a keyboard and exits with a real code; anything that genuinely cannot do that fails fast with a clear message and a non-zero exit. The pipeline you would write against any normal Unix tool is the pipeline you can now write against Nanotune, with `data import --yes` as the only flag you need to remember.

If you hit a command that does not behave the way you expect under CI, the place to start is `supportsRawMode()` in `src/lib/tty.ts`. That is the single source of truth for the TTY check, and it is the function that decides between render-and-exit and interactive-only in every command. If a future command needs to land in the render-and-exit bucket, it should call `useAutoExit` and render hints through `<ExitHint>`. If it needs to land in the interactive-only bucket, it should go through `renderInteractive` in the CLI layer.

Source, issues, and the changelog live at [github.com/Nano-Collective/nanotune](https://github.com/Nano-Collective/nanotune). If something fails under CI in a way the rules above do not cover, open an issue with the command, the output, and the CI environment, and we will work through it.
