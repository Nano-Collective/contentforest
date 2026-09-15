---
product: prompt-scrub
version: "1.4.0"
channel: reddit
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 2900
---

We shipped encryption at rest for `prompt-scrub` session files in v1.4.0. The interesting design question turned out not to be the AES-256-GCM envelope (well-scoped, scrypt KDF, per-file salt and IV) but how the passphrase actually reaches the process, because the resolver is the part that determines whether the on-disk protection is real or theatre.

Here is the wrong shape that "looks right":

```
PROMPT_SCRUB_KEY="correct horse battery staple" prompt-scrub scrub < prompt.txt
```

That single line lands the passphrase in two places before any crypto runs. Bash and zsh write the command line to history (`~/.bash_history` or `~/.zsh_history`), so it sits there for the next several thousand commands by default. On Linux, the same process started with that env var has the value visible to any process running as your user via `/proc/<pid>/environ`, until the process exits. Two leaks; the crypto was never the problem.

The two patterns that actually work are `read -rs` at a terminal and a secret-manager export. Both work because the resolver walks a fixed three-step ladder and never reads from a file: in-process cache, `PROMPT_SCRUB_KEY`, TTY prompt. If a passphrase is in `~/.config/prompt-scrub/config.json`, v1.4.0 will not see it. The API does not offer a file path, and that is on purpose, because a passphrase file is the same hazard class as a history file.

`read -rs PROMPT_SCRUB_KEY` at a TTY works because there is no command line containing the value to record. The shell variable outlives the child, but for a one-off that is fine. A long-lived shell across the day is a different story: the variable lives until the shell exits. Use it for interactive sessions, do not lean on it for always-on tooling.

For CI and scheduled jobs, the only safe option of the two is the secret-manager export shape:

```
export PROMPT_SCRUB_KEY="$(op read 'op://vault/prompt-scrub/key')"
prompt-scrub scrub
```

The `$(...)` substitution keeps the literal command line clean (the shell records `PROMPT_SCRUB_KEY="$(op read ...)"`, not the resolved value). On Linux, the value still shows up in `/proc/<pid>/environ` for the lifetime of the child, which is unavoidable for any env-var-based key delivery. The improvement over inline is *who can read it* and *for how long*: a credentialed fetch just-in-time, and the exposure window shrinks from the shell's lifetime to the child's lifetime.

The TTY-detection rule is the part that is easy to miss in design discussions. The interactive prompt refuses to run unless `process.stdin.isTTY && process.stdout.isTTY` both evaluate true. One stream redirected is enough to fail the check. That covers `echo "..." | prompt-scrub scrub`, `prompt-scrub scrub > out.txt`, `prompt-scrub scrub &` from a shell, and any detached `tmux`/`screen` pane. The failure is a one-line stderr message and a non-zero exit, not a hang. A hang in a CI job is worse than a clean failure, because a hang eventually pages a human who has no way to type a passphrase into a build job that has already moved on. So the gate is strict, deliberately.

There is a related change worth flagging at decrypt time. `SessionDecryptionError` now distinguishes wrong key from tampered file; `SessionFormatError` covers a successful decrypt that yields unparseable JSON. Before v1.4.0, both were collapsed into silent quarantine, and a wrong passphrase on a future rehydrate looked identical to a session that had simply expired. The typed error is the part that makes a real failure observable. The file on disk is not modified in any of these paths; the CLI prints the line and exits 1.

The full walkthrough, including the resolver source, the failure catalogue, and a setup checklist, is in the discussion post linked from the repo:

https://github.com/Nano-Collective/prompt-scrubber
