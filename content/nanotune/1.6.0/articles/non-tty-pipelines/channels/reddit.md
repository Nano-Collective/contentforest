---
product: nanotune
version: "1.6.0"
channel: reddit
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 8164
---

A short one from the Nanotune maintainers. v1.6.0 just shipped, and the headline is unglamorous: every command now works without a terminal. For anyone who has been bitten by this in CI, that is the entire release. For anyone who hasn't, here is the story.

## What was actually broken

Nanotune is a React-Ink TUI. Ink enables raw mode on stdin as soon as anything in the tree calls `useInput`, which is the hook you use to read keystrokes. We use `useInput` all over the place for things like "press any key to exit" frames and help bars, so raw mode was being enabled the moment the React tree mounted, not the moment the user pressed a key.

If stdin was a TTY, that is fine. If stdin was not a TTY (CI, a pipe, a Docker container without `-t`, cron, anything that does not allocate a PTY), Ink threw `ERROR Raw mode is not supported on the target process` and React's reconciler tried to render a frame anyway. The throw is fast, the stack trace is forty lines, and exit code is 1, so every command looked broken from the outside. Read-only commands. `nanotune status`. `nanotune data validate`. All of them.

Looking at the issue tracker, this has been the most common "why does this not work in CI" report for the last several releases. It was clearly overdue to fix.

## The fix in two lines

A new `src/lib/tty.ts`:

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

The strict `=== true` matters because Node leaves `isTTY` as `undefined` (not `false`) on non-TTY streams. A truthy check would let `undefined` slip through and reintroduce the crash on some Node versions. The test that pins this is in `src/lib/tty.spec.ts` and asserts that `supportsRawMode({})` returns `false`.

Every command now branches on `supportsRawMode()`. There are two buckets and nothing in between.

## Render-and-exit commands

`status`, `data validate`, `train`, `export`, `benchmark`, and `judge test` render their final output and exit on their own when there is no keyboard. The components that make this work:

- `useKeyInput(handler, isActive = true)` is a drop-in for Ink's `useInput`. It passes `isActive: false` whenever `supportsRawMode()` returns false, which means Ink never tries to enable raw mode at all.
- `useAutoExit(done, failed)` calls Ink's `exit()` as soon as `done` is true and there is no keyboard. If `failed` is true it sets `process.exitCode = 1` first.
- `<ExitHint>` renders "Press any key to exit" only when there is a keyboard. Otherwise it returns `null` so captured output is clean.

Two consequences that matter in practice. First, a failed run now sets a non-zero exit code, so `nanotune train && nanotune export` chains correctly. Second, captured output is clean: no "press any key" line at the bottom of your CI log.

## Interactive-only commands

`init`, `data add`, `data list`, `chat`, and `judge configure` genuinely need a keyboard (prompts, menus, the chat REPL). For these, `src/cli.tsx` has a `renderInteractive` helper:

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

If a script runs `nanotune chat` from CI by accident, the user gets one clear sentence and a non-zero exit code. The non-zero code is the important bit: it lets CI catch the misuse rather than carrying on as if the command succeeded.

## The new `--yes` flag

The one render-and-exit command that previously needed a keystroke was `data import`, which asks for confirmation before merging a JSONL/CSV/JSON file. v1.6.0 adds `-y, --yes`:

```bash
nanotune data import examples.jsonl --yes
```

Without a TTY and without `--yes`, the command tells you the flag is required rather than failing obscurely. With `--yes`, it imports and exits.

## A real CI pipeline

The thing you can now write that you couldn't before:

```yaml
jobs:
  retrain:
    runs-on: macos-14
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

A few notes on why this works:

- `data validate` exits non-zero on duplicate examples, broken turn alternation, missing fields, or under the minimum example count. The chain breaks early.
- `train --iterations 200` overrides whatever is in `config.json` on the runner, so the pipeline is reproducible regardless of how the checkout was configured.
- `export -q q8_0` produces an 8-bit GGUF; the pre-built llama.cpp binaries are downloaded automatically.
- `benchmark --preset medium --timeout 60000` selects the laptop preset and gives each test a 60s ceiling so a slow generation does not hang the step.

No `-t` flag on the Docker job. No `script` wrapper. No `unbuffer`. Just commands chained with `&&`.

## What stayed interactive on purpose

Worth being explicit about what v1.6.0 did not change:

- `nanotune init` walks you through creating a config; that is a guided setup, not a batch operation.
- `nanotune data add` is a REPL-shaped conversation with a "Add another turn?" prompt and an Esc-to-save escape hatch. There is no pipe-friendly version by design.
- `nanotune chat` is the inference REPL with `/reset`, `/system`, `/stats`, `/help`, `/exit` slash commands. There is no scripted equivalent on purpose; if you want a non-interactive smoke test of an exported model, use `nanotune benchmark` with a tiny dataset.
- `nanotune data list` paginates examples and lets you delete rows by index; if you need a non-interactive listing, `cat data/train.jsonl` is the right tool.
- `nanotune judge configure` writes a `judge.json` (now with `0600` permissions, also new in 1.6.0) and walks you through provider and model selection.

These refuse to run without a TTY rather than silently degrading, which is the failure mode you want from a misuse.

## What this means for contributors

Two rules that keep the non-interactive story intact:

1. Never call Ink's `useInput` directly. Use `useKeyInput` from `src/components/index.ts`, which wraps it with a `supportsRawMode()` guard.
2. Decide the command's bucket explicitly. Render-and-exit commands call `useAutoExit(done, failed)` and render hints through `<ExitHint>`. Interactive-only commands go through `renderInteractive` in the CLI layer.

If a render-and-exit command forgets the `useAutoExit` call, it will hang forever on the "Press any key to exit" frame in CI, which is the symptom to look for in code review. If an interactive-only command accidentally calls `render(node)` directly, the unit test that fails first is the one in `tty.spec.ts` that asserts the message is plain text (no `at `, at most three lines).

## Closing thought

The shape v1.6.0 leaves you with is roughly: anything that can run without a keyboard runs without a keyboard and exits with a real code; anything that genuinely cannot fails fast with a clear message and a non-zero exit. The pipeline you would write against any normal Unix tool is the pipeline you can now write against Nanotune, with `data import --yes` as the only flag worth remembering.

Source, changelog, and issues: https://github.com/Nano-Collective/nanotune

If you hit a command that does not behave the way you expect under CI, the place to start is `supportsRawMode()` in `src/lib/tty.ts`. That is the single source of truth for the TTY check, and it is the function that decides between render-and-exit and interactive-only in every command.
