---
product: prompt-scrub
version: "1.4.0"
channel: linkedin
title: ""
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 1832
---

We just shipped `prompt-scrub` v1.4.0. The headline is opt-in encryption for the session files that map placeholders back to your real values.

A session file is the most sensitive thing `prompt-scrub` writes to disk. Until now it lived there as plain JSON protected only by `0600` file permissions, so a stolen laptop, a synced backup, or any other process running as the same user got the mappings in the clear. v1.4.0 closes that gap with one config flag and a typed error path for the cases where it matters.

What changed:

- Set `"encryptionEnabled": true` in the config file. Every session write is now an AES-256-GCM envelope with a per-file random salt and IV, a 32-byte key derived through scrypt (`N=16384, r=8, p=1`), and a GCM auth tag that makes tampering detectable.
- Keys resolve in a fixed order: the in-process cache, then `PROMPT_SCRUB_KEY`, then an interactive prompt with input muted. The prompt refuses to run when stdin or stdout is redirected, so piped and CI invocations fail with a clear message instead of hanging.
- New library exports: `getEncryptionKey()`, `setCachedEncryptionKey()`, `getCachedKey()`, `clearCachedEncryptionKey()`, `encryptSession()`, `decryptSession()`, `isEncryptedEnvelope()`, and `SessionDecryptionError` (typed; distinguishes wrong key, tampered file, and no key available).
- A new `prompt-scrub sessions encrypt [id]` command migrates existing plaintext sessions, with `--rekey` to rotate the passphrase over files already encrypted.
- `sessions list` and `sessions show` ask for a key only when the file they are about to read is actually encrypted, so turning the flag on does not start demanding a passphrase for plaintext sessions.

The behaviour change worth flagging: an encrypted session that cannot be decrypted now throws the typed `SessionDecryptionError`, instead of being silently quarantined and returning an empty map that looked identical to an expired session. Writes do not downgrade either. Once a session file on disk is encrypted, later writes stay encrypted even if `encryptionEnabled` is toggled back off, so flipping the flag cannot quietly rewrite a protected map as plaintext.

Encryption is off by default and existing plaintext sessions keep working untouched. Thanks to @akramcodez for the work on this release.

Install:

```
npm install -g @nanocollective/prompt-scrub
```

Source, full docs, and the Threat Model: https://github.com/Nano-Collective/prompt-scrubber