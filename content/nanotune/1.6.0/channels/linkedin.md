---
product: nanotune
version: "1.6.0"
channel: linkedin
generated_at: "2026-08-09T21:17:17.767Z"
model: "minimax-m3"
char_count: 1538
---

Nanotune v1.6.0 is out. The big change: every command now works without a terminal.

Up to 1.5.x, piping `nanotune status` into a file, running it in CI, or dropping it into a Docker container without `-t` produced a 40-line React reconciler stack trace and exit code 1, even for read-only commands that never needed a keypress. The reason was Ink enabling raw mode as soon as anything called `useInput`, which happened for keyboard hints across the whole TUI.

1.6.0 fixes the underlying assumption. Render-and-exit commands (`status`, `data validate`, `train`, `export`, `benchmark`, `judge test`) now finish on their own when there is no TTY, exit with a real code on failure, and suppress the keyboard hints so captured output is clean. Interactive-only commands (`init`, `data add`, `data list`, `chat`, `judge configure`) print one clear sentence and exit 1 instead of crashing.

Other noteworthy things in this release:

- `nanotune data import --yes` skips the confirmation prompt, so scripted imports work.
- The platform check runs before any download or install, so unsupported hardware gets a clear message up front instead of a confusing pip resolver error.
- `judge.json` is now written with `0600` permissions, since it can hold a literal API key.
- `nanotune chat` finally has a docs page (it shipped in 1.5.0 without one).
- The coverage report is honest now, dropping from a vanity 88.62% to a real 78.97% after removing broken excludes.

Source, changelog, and full notes: https://github.com/Nano-Collective/nanotune
