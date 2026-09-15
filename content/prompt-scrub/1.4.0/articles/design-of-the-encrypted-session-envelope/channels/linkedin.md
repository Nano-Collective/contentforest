---
product: prompt-scrub
version: "1.4.0"
channel: linkedin
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 2735
---

# What is actually inside a prompt-scrub v1.4.0 encrypted session file

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.

A short tour of the v1 envelope format that ships in prompt-scrub v1.4.0, and the reasoning behind each field. Whole implementation lives in `src/core/crypto.ts` and is around 200 lines.

The on-disk shape when `encryptionEnabled` is on is a JSON object with `version`, `encrypted`, `algorithm`, `kdf`, `kdfParams`, `salt`, `iv`, `authTag`, and `ciphertext`. The first three fields are the discriminator. The rest is the cryptographic material.

A few choices worth flagging for anyone reviewing the design:

AES-256-GCM over CBC. GCM is authenticated. Every write produces an auth tag, and the decipher calls `setAuthTag` before any plaintext is produced. A tampered ciphertext fails the integrity check and throws `SessionDecryptionError`. CBC would have required a separate MAC and an ordering convention (encrypt-then-MAC) that is easy to get wrong.

Per-file random salt and IV. Both are pulled from `crypto.randomBytes` on every write. Reusing a salt across files under the same passphrase means a cracked key works for all of them. Reusing an IV under GCM collapses the cipher's security entirely. The cost is 56 bytes of hex per session.

scrypt with N=16384, r=8, p=1, instead of PBKDF2. scrypt is memory-hard. The derivation costs `N * r * 128` bytes of RAM in addition to CPU, which is what throttles GPU and ASIC brute-force attempts. PBKDF2 has no such floor, and the practical gap between the two on attacker hardware is the gap between plausible and implausible.

A KDF-param bounds check. The reader validates `kdfParams` against per-field bounds (`N` between 1024 and 1048576, `r` between 1 and 256, `p` between 1 and 16) before accepting the envelope. An attacker who can write the file cannot crank `N` to lock the reader out, or drop `N` to a brute-force-friendly value.

A derived-key cache keyed on `(passphrase, salt, kdfParams)`. scrypt is deliberately slow, so the cost factors, salt, and passphrase are joined with a NUL delimiter and stored in a process-local map. Same envelope, same key, second access is a map lookup. Different envelope or different passphrase, fresh derivation.

The write-side rule. `writeSessionMap` writes encrypted if `encryptionEnabled` is true OR if the existing file on disk is already encrypted. Toggling the config flag off does not silently downgrade a protected session to plaintext. The flag is an opt-in signal, not a current-state override.

Full walk-through with code excerpts in the GitHub Discussion:

https://github.com/Nano-Collective/prompt-scrubber

#promptscrub #nanocollective
