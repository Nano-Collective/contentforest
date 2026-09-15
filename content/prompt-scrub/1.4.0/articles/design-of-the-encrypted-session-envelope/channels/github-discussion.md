---
product: prompt-scrub
version: "1.4.0"
channel: github-discussion
title: "The encrypted session envelope, annotated"
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 14620
---

# The encrypted session envelope, annotated

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The headline for `prompt-scrub` v1.4.0 covers what the release does and how to migrate a plaintext session over to the new form. This article stays inside the same release and goes underneath that surface to the envelope itself: the bytes on disk, the choices behind each field, and the rules that keep the encryption honest when the config flag is toggled or the key is rotated. The whole crypto lives in `src/core/crypto.ts`, and it is short enough to walk through end to end.

## The envelope, on disk

When `encryptionEnabled` is on, a session file at `~/.config/prompt-scrub/sessions/<id>.json` no longer holds a plain JSON map. It holds an envelope that looks like this (field order is illustrative, not required):

```json
{
  "version": 1,
  "encrypted": true,
  "algorithm": "aes-256-gcm",
  "kdf": "scrypt",
  "kdfParams": { "N": 16384, "r": 8, "p": 1 },
  "salt": "<hex>",
  "iv": "<hex>",
  "authTag": "<hex>",
  "ciphertext": "<base64>"
}
```

Each field is doing real work. `version` and `encrypted` are the discriminator pair: a reader that does not yet understand envelopes sees `encrypted: true` and knows to bail out before treating the bytes as a placeholder map. `algorithm` and `kdf` name the cipher and the key derivation function explicitly so a future migration to a different primitive can be conditional on the field rather than on a global version bump. `kdfParams` records the scrypt cost factors used at write time, so the reader can replay the same KDF instead of trusting today's defaults. The remaining four fields are the cryptographic material itself.

`isEncryptedEnvelope()` in `crypto.ts` is what gates the discriminator. The check is strict on every typed field (`typeof === 'string'` for the four hex/base64 strings, exact-string equality for the version/algorithm/kdf literals) and on the optional `kdfParams`. A file that fails any check is treated as a plaintext map rather than as a malformed envelope, which is the safe failure direction: a future migration that introduces a new algorithm should not turn today's files into unreadable junk.

## Why AES-256-GCM, not AES-256-CBC

The two AES-256 modes people reach for are CBC and GCM. The session envelope picks GCM, and the reason is that GCM is authenticated. Every write produces an `authTag` alongside the ciphertext, and `decryptSession` calls `decipher.setAuthTag(authTag)` before any plaintext is produced. A ciphertext that has been modified after the fact, by an attacker who flipped bits in the hope of changing the placeholder map, fails the GCM integrity check and throws `SessionDecryptionError`. The error message ("The encryption key may be incorrect or the session file may have been modified") is intentionally ambiguous, because distinguishing "wrong key" from "tampered file" cleanly is itself an oracle an attacker can use; the caller who really needs to know can catch the typed error and look at the cause.

CBC would have required a separate MAC, computed in a clearly-defined order (encrypt-then-MAC, never encrypt-and-MAC, never MAC-then-encrypt), and would have made every implementation error in that order a silent integrity hole. GCM folds authentication into the cipher, which removes a class of footguns and lets the implementation stay short. The 12-byte IV is the standard GCM size and fits in a single `crypto.randomBytes(12)` call; the 16-byte auth tag is the standard GCM tag length and is what `authTagLength: 16` enforces in the decipher constructor.

## Per-file salt and IV, every time

Every encrypted session gets a fresh 16-byte salt and a fresh 12-byte IV, drawn from `crypto.randomBytes`. The salt is fed into scrypt along with the passphrase to derive the encryption key, and the IV is fed to GCM alongside the key to encrypt the JSON payload. Neither is reused across files, and neither is derived from the passphrase or from a session id.

Reusing a salt across files does not break AES, but it breaks scrypt: two files encrypted under the same passphrase and the same salt would derive the same key, and an attacker who cracks that key against one file has it for all of them. Reusing an IV with the same key under GCM is catastrophic: GCM's security collapses when an IV repeats, and the attacker can recover plaintext and forge ciphertext. The simplest defence against both is to treat randomness as per-file and let `crypto.randomBytes` pull from the OS CSPRNG. The envelope makes the per-file randomness explicit by carrying both values in the on-disk file, which costs about 56 bytes of hex string per session and removes an entire class of operator errors.

The ciphertext itself is also stored as a fresh write per session; there is no "encrypt-in-place" code path. `writeSessionMap` builds the envelope, writes it to a `*.tmp` sibling with `0600` permissions, and `rename`s over the original. The atomic rename means a crash mid-write leaves either the old file or the new file, never a partial file with a truncated ciphertext.

## scrypt over PBKDF2

The KDF is scrypt with `N=16384, r=8, p=1`, producing a 32-byte key. The reasons for picking scrypt over the more familiar PBKDF2-HMAC-SHA256 are the same reasons scrypt was designed: scrypt is memory-hard. The work to derive a key requires `N * r * 128` bytes of scratch RAM in addition to the CPU cost, and that RAM cost is the property that defends against an attacker who parallelises a brute-force attack on a GPU or an ASIC. A GPU that can run PBKDF2 at a million hashes per second against a leaked salt is held to a much lower rate by scrypt because the memory accesses do not fit on a chip that has many small cores and limited on-chip RAM.

The concrete cost is a deliberate compromise. `N=16384` is high enough that a single derivation takes tens of milliseconds on a modern CPU, which is acceptable for an interactive enable (the user is going to type a passphrase and wait a moment) but punitive for a brute-force loop. `r=8` and `p=1` add modest memory and one additional parallel lane. The combination lands in the same cost ballpark as the OWASP password-storage recommendations for interactive use, without pushing into the much-heavier scrypt territory (`N=2^20`) that would make a per-read cost noticeable in a tool that has to read and write the same file several times during a long `scrub`/`rehydrate` session.

`encryptSession` and `decryptSession` both default to `SCRYPT_PARAMS` if `kdfParams` is missing from the envelope, so a future change to the defaults remains backward-compatible with v1 envelopes that did not write the field. The default is also passed as `{ ...SCRYPT_PARAMS }` (a shallow clone) into the envelope, so the on-disk value is a snapshot of the cost factors at write time and not a live reference to a mutable constant.

## The KDF-param bounds check

A reader that accepts `kdfParams` from disk without checking it is a reader that lets an attacker set the cost factors for the next decrypt. The attacker can swap `N` to a much larger value and force the reader to spend minutes of CPU on every read, which is a cheap denial-of-service. Or they can swap `N` to a much smaller value and brute-force the passphrase against a weaker derivation. Both are real attacks, and both are blocked by `isKdfParams()` in `crypto.ts`:

```typescript
const SCRYPT_PARAM_BOUNDS: Record<keyof KdfParams, { min: number; max: number }> = {
  N: { min: 1024, max: 1048576 },
  r: { min: 1, max: 256 },
  p: { min: 1, max: 16 },
};
```

Every value must be an integer, must be within its per-field bound, and must be of the right type. A field that fails any check causes the envelope to be treated as a plaintext map (because the type guard returns `false` and `isEncryptedEnvelope` returns `false`), and the reader falls through to the plaintext path. The bounds are wide enough to cover legitimate operational changes (a future v2 envelope could use a higher `N` to track hardware improvements) and narrow enough to exclude the obvious attack values (`N=1` would let an attacker brute-force in seconds; `N=2^31` would lock a reader for hours). The check is per-field rather than cross-field, which keeps the implementation readable and keeps the failure mode boring.

## The derived-key cache, keyed on what matters

scrypt is slow on purpose, but a single session read or write is rarely the only thing a process does with the file. A long-running CLI that scrubs a multi-megabyte prompt, then rehydrates a multi-megabyte response, then writes the updated map back to disk will go through the derivation three or more times in a few seconds. Deriving the same key three times in a row wastes tens of milliseconds and gives the user no benefit.

The fix is a process-local cache:

```typescript
const derivedKeyCache = new Map<string, Buffer>();

function deriveCacheKey(key: string, salt: Buffer, params: KdfParams): string {
  return `${params.N}:${params.r}:${params.p}\0${salt.toString('hex')}\0${key}`;
}
```

The cache key is the KDF cost factors, the salt, and the passphrase, joined with a NUL byte. The NUL is the delimiter because it cannot appear in any user-supplied passphrase (Node strings can contain it, but the resolver's `assertValidKey` only rejects empty/whitespace strings, so a user who really wanted to put a NUL in their passphrase would have to type one, and the rest of the system would still work). Cost factors are in the key because two envelopes written under different `kdfParams` must not collide on the same derived key; an attacker who could downgrade the cache hit would be doing the same thing an attacker who could downgrade the on-disk envelope could, just with less evidence.

The cache is intentionally simple. There is no cryptographic hash of the passphrase in the key, because CodeQL flags SHA-256 of passwords as a hardening smell and the raw passphrase as a Map key is fine in practice: the process is short-lived, the cache is in-process, and a process-memory disclosure is a much larger problem than whether the cache key is hashed. `clearDerivedKeyCache()` exists as a test-only escape hatch and is the second half of what `clearCachedEncryptionKey()` clears in the key-manager module: one call wipes the passphrase and the derived material together.

## The write-side rule that prevents a silent downgrade

The one design decision that is more about protecting users from themselves than about defending against a network attacker is the write-side rule in `writeSessionMap`:

```typescript
const shouldEncrypt = Boolean(config.encryptionEnabled) || isSessionEncrypted(sessionId);
```

The encrypt-or-not decision is the OR of the config flag and the on-disk state of the file being overwritten. Two consequences follow.

A user who turns `encryptionEnabled` on, uses `prompt-scrub` for a while, and then turns the flag back off does not get their existing encrypted session silently re-encrypted as plaintext. The next write to that session id sees an existing encrypted file on disk and keeps writing the encrypted form, regardless of the flag. The flag is treated as an "opt in" signal, not as the current state of every file.

A user who has never turned encryption on continues to write plaintext, because both sides of the OR are false. The rule is not "always encrypt if any session was ever encrypted"; it is per-file. A first-time user who flips the flag on for one session and off again does not contaminate the rest of their sessions.

The deliberate non-feature is a UI affordance to "roll back to plaintext." There is none. The downgrade path is the explicit `prompt-scrub sessions encrypt --rekey` command, which writes the (already-encrypted) file under a new passphrase; an operator who wants to genuinely remove encryption has to delete the session file and start over. The reasoning is that the only realistic reason to want a plaintext downgrade is "I want to stop using encryption and I do not care about the historical map," and that operation is identical to "delete the file." Offering a flag that quietly downgrades would be the wrong default, because the most common reason a user flips the flag off is a temporary experiment, not a permanent policy change, and the silent-rewrite behaviour would punish the temporary experiment.

The same rule covers a less obvious case: an operator who flips `encryptionEnabled` true at the global level for the first time, runs `prompt-scrub sessions encrypt` to migrate everything, then flips the flag back off by accident. The migrated files stay encrypted; only new sessions written after the flag flip are affected, and even then only if the file was created after the flip (so there is no existing encrypted file to "stick" against). The rule has no race conditions because `isSessionEncrypted` is a synchronous read of the file's current contents, and the subsequent `writeFileSync` over the same path either sees the file as encrypted and stays encrypted, or sees the file as missing and falls back to the config flag.

## What this does not defend

Walking through the envelope is a good moment to be specific about what it does not do. The envelope protects the on-disk map from a reader who reaches the file out-of-band. It does not protect the in-process map, because the map lives as a plain JS object in the same memory as the rest of the runtime and is not encrypted at rest in memory. It does not protect the passphrase, because the passphrase is the input the operator supplies through whatever supply path the resolver selected, and that supply path has its own threat model (covered in a separate article on setting up encryption without leaking the key). It does not protect against an attacker who has write access to the file, because a write-capable attacker can replace the envelope with one they encrypted under their own key. The `authTag` makes a tampered ciphertext fail, not a replaced envelope.

What it does do, in one sentence: when a session file is on disk, the placeholder-to-original map inside it is a wrapped-and-authenticated ciphertext under a key the operator chose, and the writing path makes it difficult for an operator to undo that wrapping by accident.

Source, the threat model, and the v1.4.0 release notes live at:

https://github.com/Nano-Collective/prompt-scrubber

Issues and PRs are welcome there. For the wider conversation about how the Nano Collective designs these defaults, the [Discord](https://discord.gg/ktPDV6rekE) is open.
