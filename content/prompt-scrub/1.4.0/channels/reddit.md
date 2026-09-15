---
product: prompt-scrub
version: "1.4.0"
channel: reddit
title: ""
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 3994
---

We just shipped `prompt-scrub` v1.4.0, and we want to talk about why.

A session file is the most sensitive thing `prompt-scrub` writes to disk. It holds the placeholder-to-original map: which `«Secret_1»` stood in for which API key, which `«Email_1»` stood in for which address. Until v1.4.0 that file lived on disk as plain JSON protected only by `0600` file permissions. A stolen laptop, a synced backup, or any other process running as the same user could read the mappings in the clear. We knew about the gap when we shipped v1.0.0 and called it out in the Threat Model, but calling it out is not the same as fixing it. v1.4.0 is the fix.

## The shape

Setting `"encryptionEnabled": true` in the config file makes every session write an AES-256-GCM envelope: a per-file random salt and IV, a 32-byte key derived through scrypt (`N=16384, r=8, p=1`), and a GCM auth tag that makes tampering detectable rather than silently decodable.

Keys resolve in a fixed order:

1. The in-process cache (`setCachedEncryptionKey()`).
2. The `PROMPT_SCRUB_KEY` environment variable.
3. An interactive prompt with input muted.

The interactive prompt refuses to run when stdin or stdout is redirected, so a piped or CI invocation fails with a clear message instead of hanging on a TTY that is not there. Enabling encryption for the first time asks for the passphrase twice and aborts on a mismatch, because a typo at that point would permanently lock the session.

Library callers get a small set of new exports at the package root: `getEncryptionKey()`, `setCachedEncryptionKey()`, `getCachedKey()`, `clearCachedEncryptionKey()`, `encryptSession()`, `decryptSession()`, `isEncryptedEnvelope()`, and `SessionDecryptionError`. Derived keys are cached per `(passphrase, salt, KDF params)` tuple, so `scrub`/`rehydrate` do not pay the deliberately expensive scrypt cost on every read and write.

## Migrating existing plaintext sessions

A new command, `prompt-scrub sessions encrypt [id]`, migrates sessions that are already on disk. `id` is optional and defaults to all sessions. `--rekey` rotates the passphrase over files that are already encrypted. The command refuses to run unless `encryptionEnabled` is set, never fabricates a file for a session id that does not exist, and reports how many sessions it encrypted, skipped, and could not find.

`sessions list` and `sessions show` ask for a key only when the file they are about to read is actually encrypted. Turning the flag on does not start demanding a passphrase for plaintext sessions.

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

The migration is offline. It reads each session file, encrypts it under the supplied key, atomically replaces the original, and prints a one-line summary. There is no upload, no network round-trip, and no remote state.

## The behaviour change worth flagging

Reading an encrypted session that cannot be decrypted now throws the typed `SessionDecryptionError`, distinguishing "wrong key", "tampered file", and "no key available", instead of quarantining the file and returning an empty map. The previous behaviour looked identical to a session that had simply expired, which made real failures invisible. Silent quarantine is still the behaviour for genuinely unparseable JSON, where the file is corrupt rather than the key being wrong.

Writes do not downgrade either. Once a session file on disk is encrypted, later writes to it stay encrypted even if `encryptionEnabled` is toggled back off, so flipping the flag cannot quietly rewrite a protected map as plaintext. If you want to roll encryption back deliberately, the path is to migrate under the new key, then turn the flag off and let a fresh session map itself.

Encryption is off by default, and existing plaintext sessions keep working untouched. Nothing in v1.4.0 forces an upgrade path; the only reason to turn the flag on is to defend the on-disk map, and the only reason to migrate existing sessions is to bring them under that same defence.

## What this is and is not

This release narrows one specific gap: an attacker who reaches the session file on disk no longer gets the placeholder-to-original mappings in the clear. It does not address the rest of the threat surface. The Threat Model still describes what is and is not defended in one place, and the distinction still matters: a user who believes the tool makes them anonymous is worse off than one who never used it, because they stop reading their prompts and trust the defaults. Always run `inspect` first.

## Install

```bash
npm install -g @nanocollective/prompt-scrub
```

Source, full docs, and the Threat Model: https://github.com/Nano-Collective/prompt-scrubber

This release shipped thanks to @akramcodez and closes #94. Issues and PRs at the repo. We hang out in the Nano Collective Discord if you want to talk about any of it: https://discord.gg/ktPDV6rekE