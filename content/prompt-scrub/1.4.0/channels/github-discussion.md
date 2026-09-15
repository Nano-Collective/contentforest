---
product: prompt-scrub
version: "1.4.0"
channel: github-discussion
title: "prompt-scrub v1.4.0: encrypt local session files at rest"
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 6892
distributed_at: "2026-09-15T19:45:02.744Z"
---

# prompt-scrub v1.4.0: encrypt local session files at rest

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

`prompt-scrub` v1.4.0 ships opt-in encryption for the session files that map placeholders back to your real values. The motivating problem was uncomfortable and overdue: a session file holds the placeholder-to-original map, and v1 left it on disk as plain JSON protected only by `0600` file permissions. A stolen laptop, a synced backup, or any other process running as the same user could read the mappings in the clear. v1.4.0 makes that opt-in fix available with one config flag, and a typed error path for the cases where it matters.

## What changed

Setting `"encryptionEnabled": true` in the config file makes every session write an AES-256-GCM envelope: a per-file random salt and IV, a 32-byte key derived through scrypt (`N=16384, r=8, p=1`), and a GCM auth tag that makes tampering detectable rather than silently decodable.

Keys are resolved in a fixed order:

1. The in-process cache (`setCachedEncryptionKey()`).
2. The `PROMPT_SCRUB_KEY` environment variable.
3. An interactive prompt with input muted.

The interactive prompt refuses to run when stdin or stdout is redirected, so a piped or CI invocation fails with a clear message instead of hanging on a TTY that is not there. Enabling encryption for the first time asks for the passphrase twice and aborts on a mismatch, because a typo at that point would permanently lock the session.

Library callers get a small set of new exports at the package root:

- `getEncryptionKey()`, `setCachedEncryptionKey()`, `getCachedKey()`, `clearCachedEncryptionKey()`
- `encryptSession()`, `decryptSession()`, `isEncryptedEnvelope()`
- `SessionDecryptionError` (typed; distinguishes wrong key, tampered file, and no key available)

Derived keys are cached per `(passphrase, salt, KDF params)` tuple, so `scrub`/`rehydrate` do not pay the deliberately expensive scrypt cost on every read and write. `clearCachedEncryptionKey()` wipes the passphrase and the derived material together.

## Migrating existing plaintext sessions

A new command, `prompt-scrub sessions encrypt [id]`, migrates sessions that are already on disk. `id` is optional and defaults to all sessions; pass a specific id to scope the run. `--rekey` rotates the passphrase over files that are already encrypted. The command refuses to run unless `encryptionEnabled` is set, never fabricates a file for a session id that does not exist, and reports how many sessions it encrypted, skipped, and could not find.

`sessions list` and `sessions show` ask for a key only when the file they are about to read is actually encrypted. Turning the flag on does not start demanding a passphrase for plaintext sessions. An undecryptable session in `list` is reported on that row rather than aborting the whole listing.

A worked example:

```bash
# Enable encryption in the config file
# ~/.config/prompt-scrub/config.json
# { "encryptionEnabled": true }

# Read your passphrase from a secret manager; do not echo it inline.
export PROMPT_SCRUB_KEY
read -rs PROMPT_SCRUB_KEY

# Migrate every existing plaintext session to the encrypted form.
prompt-scrub sessions encrypt

# Rotate the passphrase over files that are already encrypted.
prompt-scrub sessions encrypt --rekey
```

The migration is offline: it reads each session file, encrypts it under the supplied key, atomically replaces the original, and prints a one-line summary. There is no upload, no network round-trip, and no remote state.

## Behaviour change worth flagging

Reading an encrypted session that cannot be decrypted now throws the typed `SessionDecryptionError`, distinguishing "wrong key", "tampered file", and "no key available", instead of quarantining the file and returning an empty map. The previous behaviour looked identical to a session that had simply expired, which made real failures invisible. Silent quarantine is still the behaviour for genuinely unparseable JSON, where the file is corrupt rather than the key being wrong.

Writes do not downgrade. Once a session file on disk is encrypted, later writes to it stay encrypted even if `encryptionEnabled` is toggled back off, so flipping the flag cannot quietly rewrite a protected map as plaintext. If you want to roll encryption back deliberately, the path is `sessions encrypt --rekey` to a new plaintext state, then turn the flag off and let a fresh session map itself.

Encryption is off by default, and existing plaintext sessions keep working untouched. Nothing in v1.4.0 forces an upgrade path; the only reason to turn the flag on is to defend the on-disk map, and the only reason to migrate existing sessions is to bring them under that same defence.

## Notes on the threat model

This release narrows one specific gap: an attacker who reaches the session file on disk no longer gets the placeholder-to-original mappings in the clear. It does not address the rest of the threat surface, and the [Threat Model](https://github.com/Nano-Collective/prompt-scrubber/blob/main/docs/features/threat-model.md) still describes what is and is not defended in one place. A user who believes this tool makes them anonymous is worse off than one who never used it, because they stop reading their prompts and trust the defaults. Always run `inspect` first.

## Install

```bash
npm install -g @nanocollective/prompt-scrub
```

Source, full docs, and the Threat Model live at the repo:

https://github.com/Nano-Collective/prompt-scrubber

## Credits

This release shipped thanks to [@akramcodez](https://github.com/akramcodez). Closes #94.

Issues and PRs are welcome at the repo. There is also a [Nano Collective Discord](https://discord.gg/ktPDV6rekE) for the wider conversation about what the collective is building and why.