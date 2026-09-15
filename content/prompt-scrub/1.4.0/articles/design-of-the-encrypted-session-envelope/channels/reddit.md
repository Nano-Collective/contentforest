---
product: prompt-scrub
version: "1.4.0"
channel: reddit
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 9247
---

# The encrypted session envelope in prompt-scrub v1.4.0: a behind-the-scenes tour

Hi, Will here from the Nano Collective. We just shipped `prompt-scrub` v1.4.0 with opt-in AES-256-GCM encryption of session files, and the headline post on GitHub covers what changed and how to migrate. This is the article for the people who want to see what is actually inside the envelope, why each field is there, and which decisions were non-obvious.

The whole crypto module is in `src/core/crypto.ts`. It is short, so the post points at specific lines and explains why they exist.

## The shape

A v1.4.0 encrypted session file on disk looks like this:

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

Three groups of fields. The first three are the discriminator: `version`, `encrypted`, and the algorithm/kdf names. A reader that does not understand envelopes sees `encrypted: true` and refuses to treat the bytes as a placeholder map. The `kdfParams` field records the scrypt cost factors used at write time, so the reader can replay the same KDF instead of trusting today's defaults. The last four fields are the cryptographic material.

`isEncryptedEnvelope()` enforces the discriminator strictly. Every typed field is checked (`typeof === 'string'` for the hex/base64 fields, exact equality for the version/algorithm/kdf literals). A file that fails any check falls through to the plaintext path. The safe failure direction is "treat it as plaintext," because a future migration that introduces a new algorithm should not turn today's files into unreadable junk.

## Why GCM and not CBC

The two AES-256 modes people reach for are CBC and GCM. The session envelope picks GCM, and the reason is authentication. Every write produces an `authTag` alongside the ciphertext, and `decryptSession` calls `decipher.setAuthTag(authTag)` before producing any plaintext. A bit-flipping attacker who modifies the ciphertext in place fails the GCM integrity check and gets `SessionDecryptionError`. The message text is deliberately ambiguous between "wrong key" and "tampered file," because distinguishing those cleanly is an oracle an attacker could use.

CBC would have required a separate MAC, computed in the right order (encrypt-then-MAC, never the other two), and any implementation error in that ordering is a silent integrity hole. GCM folds authentication into the cipher, which removes a class of footguns and keeps the implementation short. The 12-byte IV is the standard GCM size. The 16-byte auth tag is the standard GCM tag length, and it is what `authTagLength: 16` enforces.

## Per-file random salt and IV

Every encrypted session gets a fresh 16-byte salt and a fresh 12-byte IV, both from `crypto.randomBytes`. The salt feeds scrypt along with the passphrase; the IV feeds GCM alongside the derived key. Neither is reused across files.

Reusing a salt across files under the same passphrase does not break AES, but it breaks scrypt: a cracked key works for all of them. Reusing an IV with the same key under GCM is catastrophic, because GCM's security collapses on IV repetition. The simplest defence is per-file randomness from the OS CSPRNG, made explicit in the envelope for about 56 bytes of hex per session.

## scrypt instead of PBKDF2

scrypt with `N=16384, r=8, p=1`, producing a 32-byte key, is the KDF choice. scrypt is memory-hard: the derivation costs `N * r * 128` bytes of scratch RAM in addition to CPU, and that RAM cost is what throttles an attacker who parallelises a brute-force on a GPU or an ASIC. PBKDF2 has no such floor; a GPU runs millions of PBKDF2 hashes per second against a leaked salt. The same hardware holds scrypt to a much lower rate because the memory accesses do not fit on a chip with many small cores and limited on-chip RAM.

`N=16384` lands one derivation in the tens-of-milliseconds range on a modern CPU, which is fine for an interactive enable but punitive for a brute-force loop. `r=8` and `p=1` add modest memory and one additional parallel lane, in the same ballpark as the OWASP password-storage recommendations for interactive use, without pushing into heavier scrypt territory (`N=2^20`) that would make per-read cost noticeable across a long scrub-and-rehydrate cycle.

`encryptSession` and `decryptSession` default to `SCRYPT_PARAMS` if `kdfParams` is missing, so a future default change stays backward-compatible with v1 envelopes. The default is passed as `{ ...SCRYPT_PARAMS }` (a shallow clone), so the on-disk value is a snapshot of the cost factors at write time, not a live reference to a mutable constant.

## The KDF bounds check

A reader that accepts `kdfParams` without checking it lets an attacker set the cost factors for the next decrypt. They can crank `N` high and lock the reader out, or drop `N` low and brute-force the passphrase cheaply. Both are blocked by `isKdfParams()`:

```typescript
const SCRYPT_PARAM_BOUNDS: Record<keyof KdfParams, { min: number; max: number }> = {
  N: { min: 1024, max: 1048576 },
  r: { min: 1, max: 256 },
  p: { min: 1, max: 16 },
};
```

Every value must be an integer, in bounds, and of the right type. A failure flips the envelope into the plaintext path. The bounds are wide enough for a future v2 envelope to use a higher `N` as hardware improves, and narrow enough to exclude the obvious attack values (`N=1` for fast brute-force; `N=2^31` for a denial-of-service lock-out). Per-field rather than cross-field, so the failure mode stays boring.

## The derived-key cache

scrypt is slow on purpose, but a single session read is rarely the only thing a process does with the file. A long-running scrub-and-rehydrate cycle derives the same key several times in a few seconds.

The fix is a process-local cache keyed on `${N}:${r}:${p}\0${salt}\0${passphrase}`. Cost factors are in the key so two envelopes with different `kdfParams` cannot collide, and NUL is the delimiter because it cannot appear in any user-typed passphrase. There is no cryptographic hash of the passphrase: SHA-256 of passwords flags as a hardening smell on CodeQL, and the raw passphrase as a Map key is fine in practice because the cache is short-lived and process-local. `clearDerivedKeyCache()` exists as a test-only escape hatch and is the second half of what `clearCachedEncryptionKey()` clears.

## The write-side rule

The one design decision that protects users from themselves more than from network attackers is in `writeSessionMap`:

```typescript
const shouldEncrypt = Boolean(config.encryptionEnabled) || isSessionEncrypted(sessionId);
```

The encrypt-or-not decision is the OR of the config flag and the on-disk state of the file being overwritten. Two consequences follow.

A user who turns `encryptionEnabled` on, uses `prompt-scrub` for a while, and then turns the flag back off does not get their existing encrypted session silently re-encrypted as plaintext. The next write to that session id sees an existing encrypted file on disk and keeps writing the encrypted form, regardless of the flag. The flag is treated as an opt-in signal, not as the current state of every file.

A user who has never turned encryption on continues to write plaintext, because both sides of the OR are false. The rule is per-file, not "always encrypt if any session was ever encrypted."

The deliberate non-feature is a UI affordance to roll back to plaintext. There is none. The downgrade path is the explicit `prompt-scrub sessions encrypt --rekey` command, which writes the already-encrypted file under a new passphrase; an operator who wants to genuinely remove encryption has to delete the session file and start over. The reasoning is that the only realistic reason to want a plaintext downgrade is "I do not care about the historical map," and that operation is identical to "delete the file." A flag that quietly downgrades would be the wrong default, because the most common reason a user flips the flag off is a temporary experiment, not a permanent policy change, and silent rewrite would punish the experiment.

## What this does and does not do

The envelope defends the on-disk map from an out-of-band reader. It does not defend the in-process map (the placeholder map lives as a plain JS object in the same runtime memory) or the passphrase (the supply path is the operator's responsibility, with its own threat model). It also does not defend against an attacker who has write access to the file, because such an attacker can replace the envelope with one encrypted under their own key. The auth tag catches a tampered ciphertext, not a replaced envelope.

What it does do: when a session file is on disk, the placeholder-to-original map is an authenticated ciphertext under a key the operator chose, and the writing path makes it hard for an operator to undo that wrapping by accident.

Source, the threat model, and the v1.4.0 release notes are at:

https://github.com/Nano-Collective/prompt-scrubber

Issues and PRs are welcome there. The Nano Collective Discord (linked from the repo) is open for the wider conversation about how these defaults get designed.
