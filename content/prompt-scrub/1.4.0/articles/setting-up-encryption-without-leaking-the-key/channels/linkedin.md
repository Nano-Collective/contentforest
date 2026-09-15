---
product: prompt-scrub
version: "1.4.0"
channel: linkedin
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 1900
---

prompt-scrub v1.4.0 ships opt-in encryption for the on-disk session map. The headline covered the crypto. The harder question is how the passphrase actually reaches the process without leaking somewhere worse than the file we just protected.

Three patterns to avoid:

1. Inline `PROMPT_SCRUB_KEY="..." prompt-scrub scrub`. The shell records the assignment in `~/.bash_history` (or `~/.zsh_history`), and on Linux the value is also readable from `/proc/<pid>/environ` by any process running as the same user, for the lifetime of the process. Two leaks before the crypto runs.

2. Putting the passphrase in `~/.config/prompt-scrub/config.json` or in a sidecar file. v1.4.0 does not read from either. The resolver walks three steps only: the in-process cache, the env var, then a TTY prompt.

3. Letting `prompt-scrub` fall through to the interactive prompt under a non-interactive shell. A piped or backgrounded invocation hits a strict `isTTY` gate and exits non-zero with a one-line message. The gate is there on purpose: a hang in CI is worse than a clean failure.

Two patterns that work:

- `read -rs PROMPT_SCRUB_KEY` at a terminal, then run the command. The passphrase never touches history because there is no command line containing the value.

- `export PROMPT_SCRUB_KEY="$(op read 'op://vault/prompt-scrub/key')"` (or `vault`, `aws secretsmanager`, `gcloud secrets`, `pass`). The secret manager fetches just-in-time from a credential, and the env var is only set for the child's lifetime. The `$(...)` substitution keeps the literal command line clean.

The CLI also distinguishes a wrong key from a tampered file at decrypt time. `SessionDecryptionError` for the former, `SessionFormatError` for the latter. Before v1.4.0 both were silent quarantine and looked like an empty session.

Full walkthrough, the resolver source, and the failure catalogue are in the discussion post. Repo and threat model at https://github.com/Nano-Collective/prompt-scrubber.
