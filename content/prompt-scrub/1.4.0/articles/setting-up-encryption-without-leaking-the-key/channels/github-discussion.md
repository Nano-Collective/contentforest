---
product: prompt-scrub
version: "1.4.0"
channel: github-discussion
title: "Setting up prompt-scrub encryption without leaking the key"
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 11000
---

# Setting up prompt-scrub encryption without leaking the key

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The headline announcement for v1.4.0 covers what changed: opt-in AES-256-GCM envelopes on session files, the `sessions encrypt` migration command, and the typed `SessionDecryptionError`. This article stays inside that release but drills into the one piece the headline only sketches: how the key actually reaches the process. That supply path is the part most likely to undo the encryption if it is wired carelessly, and the design choices in v1.4.0 are deliberately built to make careless wiring fail loudly rather than silently.

## What the resolver is doing, exactly

When a CLI command needs an encryption key, `getEncryptionKey()` in `src/core/key-manager.ts` walks a fixed three-step ladder:

1. The in-process cache (`cachedKey`). Set by `setCachedEncryptionKey()`, library callers' direct injection path.
2. `process.env.PROMPT_SCRUB_KEY`, when defined and non-empty. The scripting path.
3. An interactive prompt via `promptPassword()`. The interactive path.

The order matters. If a library caller already injected a key via `setCachedEncryptionKey(process.env.MY_APP_KEY)`, the env var is bypassed for that process. If the env var is set, the prompt is bypassed. The prompt is the last resort, and it is the only one that can fail the command loudly for a misconfigured caller.

`assertValidKey()` rejects anything that is not a non-empty, non-whitespace string. That filter catches the genuinely-broken cases (unset, `""`, `"   "`) and stops there. A passphrase with deliberate leading or trailing spaces is preserved verbatim, which matters for the small but real set of users who treat spaces as significant bytes of entropy.

The cache is process-scoped. It does not persist across runs, it is not written to disk, and `clearCachedEncryptionKey()` wipes both the cached passphrase and the derived-key cache in one call. There is no "saved key" feature; the only persistence is the env var the caller chose to set, and that decision lives entirely outside the process.

## Why inline `PROMPT_SCRUB_KEY=...` is the wrong way

The shape that looks most convenient:

```bash
PROMPT_SCRUB_KEY="correct horse battery staple" prompt-scrub scrub < prompt.txt
```

is also the shape that leaks the passphrase twice on a stock Linux box, before it ever reaches the crypto.

**Shell history.** Most shells record `KEY=value` assignments that appear at the start of a command line. Bash with the default `HISTCONTROL` writes the line to `~/.bash_history`. Zsh's `HISTFILE` does the same. The default `HISTFILESIZE` is several thousand lines, so the passphrase sits in a plain-text file readable by every process running as your user (and by anyone who later reads the backup). `PROMPT_SCRUB_KEY=$(vault read ...)` is the same hazard with the same shape; the shell does not care where the value came from, only that it was inline on the command line.

**`/proc/<pid>/environ`.** Linux exposes the initial environment of every running process to any process running as the same user, via `/proc/<pid>/environ`. The values are NUL-separated and not quoted, so a `grep -aE 'PROMPT_SCRUB_KEY=.*' /proc/$(pgrep -f prompt-scrub)/environ` finds the passphrase for any process that started with the env var set, including shells, build pipelines, CI runners, and any sidecar script the parent spawned. The exposure window is the lifetime of the process, plus however long the system keeps `/proc` entries for finished processes. macOS does not expose `/proc/<pid>/environ` to other users, but the shell-history problem still applies.

A second-order hazard: shell aliases, shell functions, and `make` recipes that capture `$(cmd PROMPT_SCRUB_KEY=...)` expand the assignment into a child process and into the parent's debug output. CI logs that capture the expanded command line record the passphrase even when the user "did not type it."

The inline form is not broken: the crypto will work. It is just unsafe by default, and there is no flag in `prompt-scrub` that turns the hazard off, because the hazard is in the shell, not in the tool.

## The two safe ways to get the value into the env

Both patterns work with the resolver unchanged; the difference is where the bytes live before the child process reads them.

**Pattern A: `read -rs`.** Read the passphrase into a shell variable interactively, with `-r` to disable backslash mangling and `-s` to keep the input off the terminal echo. Then export it for the child.

```bash
export PROMPT_SCRUB_KEY
read -rs PROMPT_SCRUB_KEY   # prompt does not echo; variable is set
echo "sk-..." | prompt-scrub scrub
```

This works for a single command run by a human at a terminal. The passphrase is typed once, lives in the shell variable for the lifetime of that shell, never touches `HISTFILE` (because there is no command line containing the value), and is never visible in another shell's `/proc/<pid>/environ` because the value is only set after the shell started. The cost is that the shell variable outlives the child; a script that walks away from a terminal leaves the passphrase in memory until the shell exits. That is fine for a one-off; it is not fine for a long-lived shell that the user keeps open across the day.

A related variant uses `read -rs` inside a script that is itself invoked from a TTY, with the script never writing the value back to a file. The hazard profile is the same as the interactive case: typed once, lives in the current shell's memory, gone when the shell exits.

**Pattern B: secret-manager export.** A real secrets store (1Password CLI, `op`; `vault kv get -format=json`; AWS Secrets Manager via `aws secretsmanager get-secret-value`; `gcloud secrets versions access`; a `pass`/`gpg`-encrypted file) hands the value to the child as part of the env it was launched with. The shape:

```bash
export PROMPT_SCRUB_KEY="$(op read 'op://vault/prompt-scrub/key')"
echo "sk-..." | prompt-scrub scrub
```

The value still appears in the child's `/proc/<pid>/environ`, and that is unavoidable on Linux for any env-var-based key delivery. What changes is *who can read it*. The secret manager fetched the value just-in-time from a credential the calling process proved access to (a session token, a biometric prompt, a TTY-attached secret), and it does not write the value to a history file or a config file. The exposure window is the lifetime of the child, not the lifetime of a shell history line. The `$(...)` substitution also keeps the value out of the shell history, because the literal command line recorded is `PROMPT_SCRUB_KEY="$(op read ...)"`; the shell records the command, not the substitution result.

The two patterns are not equivalent, and the difference is worth being specific about.

| Aspect | `read -rs` | secret-manager export |
| --- | --- | --- |
| Where the bytes come from | User typing at a TTY | A credentialed fetch from a store |
| Lifetime in memory | Shell variable, until the shell exits | Child process env var, until it exits |
| Shell history | Not written | Not written (the command is the recorded string) |
| `/proc/<pid>/environ` on Linux | Exposed to same-user processes for the shell's lifetime | Exposed to same-user processes for the child's lifetime only |
| Works non-interactively (CI) | No, it is a TTY prompt | Yes, with a service-account credential |
| Survives across runs | No, the shell exits | Yes, the secret persists in the store |
| Rotation cost | Re-type | Re-fetch, no shell history to scrub |

For CI, secret-manager export is the only safe option of the two; `read -rs` does not work without a TTY, and the resolver's TTY gate (covered next) is the reason `read -rs` does not work without a TTY. For a developer at a workstation, `read -rs` is fine and is the lowest-friction option that does not land the passphrase in `HISTFILE`.

A third pattern is worth naming only to dismiss it: putting the passphrase in `~/.config/prompt-scrub/config.json` or in a `~/.prompt-scrub-key` file. v1.4.0 does not read from either location. The resolver reads the cache, the env var, and the TTY prompt, in that order. A file path would have been the wrong design choice for a passphrase, so the API does not offer one. If a user wants the convenience of a file, the right tool is the secret manager, with the export to the env var happening at invocation time.

## The TTY-detection rule

The interactive prompt is gated by an `isTTY` check that comes from the `defaultIO()` helper:

```typescript
function defaultIO(): PromptIO {
  return {
    input: process.stdin,
    output: process.stdout,
    isTTY: Boolean(process.stdout.isTTY && process.stdin.isTTY),
  };
}
```

The check is `Boolean(process.stdout.isTTY && process.stdin.isTTY)`, evaluated as a logical AND. Both streams must report `isTTY === true`. If either is redirected (a pipe, a file, a `</dev/null`), the AND short-circuits to `false`, and `promptPassword` throws:

```
Encryption is enabled but no PROMPT_SCRUB_KEY was provided. Cannot prompt for password interactively because stdin or stdout is redirected.
```

The error text is the literal string from the source. The CLI resolver (`runCliAction` in `src/core/cli-key-resolver.ts`) catches the error and prints the message to stderr, then `process.exit(1)`. A piped invocation that hits this branch fails immediately with a one-line message; it does not hang waiting for input that will never arrive, and it does not proceed with an empty passphrase.

Three things to know about how this behaves in practice:

**One stream is enough to fail the check.** `echo "..." | prompt-scrub scrub` redirects stdin but leaves stdout as a TTY; the AND still evaluates to `false` because stdin is no longer a TTY. `prompt-scrub scrub > out.txt` redirects stdout but leaves stdin as a TTY; the AND still evaluates to `false`. The check is deliberately strict: both ends must be a terminal, because muted input without echo only makes sense when the output device is a terminal that the user can see.

**A backgrounded process loses TTY state.** Running `prompt-scrub scrub &` from a shell, or running it under `nohup`, or running it from a `tmux`/`screen` session whose pane is detached, leaves `process.stdin.isTTY` undefined. The same error fires. There is no fallback path that quietly retries with a different I/O assumption.

**The error pre-empts `PROMPT_SCRUB_KEY` resolution.** The check is in `promptPassword`, which is the third step of the resolver ladder. If the env var is set, the prompt is never reached, so the TTY gate does not fire. If the env var is unset and the streams are not TTYs, the prompt is the only remaining path, and it refuses to run. A CI pipeline that forgot to set `PROMPT_SCRUB_KEY` and that is running under a non-interactive shell gets the one-line error and exits non-zero. That is the intended behaviour: a hang in a CI job is worse than a clean failure, because a hang usually means a human is eventually paged, and the human has no way to type a passphrase into a build job that has already moved on.

The test suite covers the gate explicitly. `promptPassword` accepts an `io` argument for the same reason: tests inject a fake `PromptIO` with `isTTY: false` and assert the error string. Production callers omit `io`, so they get the real `defaultIO()` result.

## What each failure looks like at the terminal

A short catalogue, in the form the resolver actually prints, so a user running into one of these can map it back to the cause:

- `PROMPT_SCRUB_KEY` unset, interactive shell, encryption on: the prompt runs with input muted. Type the passphrase, press Enter. Done.
- `PROMPT_SCRUB_KEY` unset, piped or backgrounded shell, encryption on: stderr gets `Encryption is enabled but no PROMPT_SCRUB_KEY was provided. Cannot prompt for password interactively because stdin or stdout is redirected.` and exit code is `1`.
- `PROMPT_SCRUB_KEY` set but empty (`PROMPT_SCRUB_KEY=""`): the resolver skips the env var because `assertValidKey` rejects empty/whitespace strings, falls through to the prompt, hits the TTY gate (if non-interactive), fails with the same redirected-I/O message.
- `PROMPT_SCRUB_KEY` set to a valid value, but the session on disk was encrypted with a different passphrase: `decryptSession` throws `SessionDecryptionError: Unable to decrypt session. The encryption key may be incorrect or the session file may have been modified.`. The CLI prints that line to stderr and exits `1`. The file on disk is not modified.
- `PROMPT_SCRUB_KEY` set, encryption on, but the session file is unparseable JSON after a successful decrypt: `decryptSession` throws `SessionFormatError: Session decrypted successfully but its payload is not valid JSON. The file is corrupt.`. The typed error lets a caller distinguish a wrong-key failure from a corrupt-file failure; before v1.4.0, both were collapsed into silent quarantine, and the user could not tell which one had happened.

The `SessionDecryptionError` distinction is worth highlighting because it is the part of the design that makes the wrong-key failure observable. A user who typed their passphrase once and never again would, on a future rehydrate, get either an obvious error or silent empty output depending on the release they were running. v1.4.0 picks the obvious error, by design.

## A short checklist for setting this up well

1. Decide where the passphrase lives at rest. A password manager entry, a `pass`-encrypted file, a cloud secrets manager, or an org-internal vault. None of these are inside `prompt-scrub`; the tool does not pick.
2. Put `encryptionEnabled: true` in `~/.config/prompt-scrub/config.json` (or the per-platform equivalent).
3. At invocation time, set `PROMPT_SCRUB_KEY` via `read -rs` (interactive) or via a secret-manager export (CI, scheduled jobs, agents). Do not put it inline on the command line.
4. Migrate any pre-existing plaintext sessions with `prompt-scrub sessions encrypt`. Pass `--rekey` later to rotate the passphrase over already-encrypted sessions.
5. Verify with `prompt-scrub inspect` on a real prompt: the file under `~/.config/prompt-scrub/sessions/<id>.json` should now contain an envelope with `version: 1`, `algorithm: aes-256-gcm`, `kdf: scrypt`, a `salt`, an `iv`, an `authTag`, and `ciphertext`, not the plaintext placeholder map.
6. On rotation, run `prompt-scrub sessions encrypt --rekey` with the new passphrase. The command refuses to overwrite files it cannot decrypt under the supplied key, so a rotation that loses access to the old key does not silently destroy the map.

There is no step that puts the passphrase on disk under `~/.config/prompt-scrub/`, and there is no config field that holds one. The threat model in the README is explicit that the encryption defends the on-disk map; the key-supply path is the operator's responsibility, and the resolver's job is to make a mistake in that path visible (a non-zero exit, a typed error, a redirected-I/O message) rather than silent.

Source, the threat model, and the full CLI reference live at:

https://github.com/Nano-Collective/prompt-scrubber

Issues and PRs are welcome there. For the wider conversation about how the Nano Collective designs these defaults, the [Discord](https://discord.gg/ktPDV6rekE) is open.
