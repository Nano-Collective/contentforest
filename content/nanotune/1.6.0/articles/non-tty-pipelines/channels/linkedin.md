---
product: nanotune
version: "1.6.0"
channel: linkedin
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 2107
---

Nanotune v1.6.0 makes every command safe to chain from CI, cron, or a Docker container without a TTY.

Up to 1.5.x, even read-only commands like `nanotune status` crashed with a 40-line React stack trace the moment they ran under a pipe or a CI step, because Ink enabled raw mode as soon as the React tree mounted. v1.6.0 splits the CLI into two explicit buckets:

- Render-and-exit commands (`status`, `data validate`, `train`, `export`, `benchmark`, `judge test`) finish on their own when there is no keyboard, set a real exit code on failure, and suppress keyboard hints so captured output is clean.
- Interactive-only commands (`init`, `data add`, `data list`, `chat`, `judge configure`) print one clear sentence and exit 1 instead of crashing, which lets CI catch the misuse rather than carrying on.

The practical change is that pipelines now work the way you would expect:

```bash
nanotune data validate && nanotune train && nanotune export && nanotune benchmark --preset medium
```

`data validate` exits non-zero on duplicate examples, broken turn alternation, missing fields, or under the minimum example count, so the chain breaks early in CI. `data import` gets a new `--yes` flag for scripted imports.

In Docker, no `-t` flag is needed. In cron, no `unbuffer` wrapper. In systemd, no `pty` allocation. The only thing to remember is that the genuinely interactive commands (`chat`, `init`, `data add`, `data list`, `judge configure`) refuse to run without a TTY rather than silently degrading, which is the failure mode you want.

The internal plumbing is small and testable: `src/lib/tty.ts` exposes `supportsRawMode()` (strict `isTTY === true`, so Node's `undefined` does not slip through) and `interactiveRequiredMessage(command)` for the standard wording. The component layer adds `useKeyInput` (the only sanctioned way to read keys), `useAutoExit(done, failed)` (exits without a keyboard and sets a non-zero code on failure), and `ExitHint` (renders keyboard hints only when there is a keyboard to act on them).

Source, changelog, and issues: https://github.com/Nano-Collective/nanotune
