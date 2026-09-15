---
product: prompt-scrub
version: "1.4.0"
channel: reddit
title: ""
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 6880
---

We shipped opt-in session encryption in `prompt-scrub` v1.4.0, and a few people have asked about the migration path: what actually happens if you turn the flag on with a stack of plaintext sessions already on disk, and what the failure modes look like when something goes wrong. This post walks through the `prompt-scrub sessions encrypt [id]` command the way it actually runs in the operator's shell, not the way the README compresses it into a paragraph.

The short version: the command is built around a few specific failure shapes, and every refusal is there to keep a recoverable mistake from becoming an unrecoverable one.

## The pre-flight

Before the command touches a single file, three things have to be true:

1. `encryptionEnabled` is `true` in the config. If it is off, the command prints a one-line message telling the operator to flip it, and exits 1. There is no `--force` because, without the flag, the rest of the system does not know to ask for a key when it reads a session later. Encrypting without the flag is the kind of "helpful" that produces a file nobody can read.

2. The resolver returns a key. The cache first, then `PROMPT_SCRUB_KEY`, then the TTY prompt with input muted. Any failure here exits 1.

3. If the operator passed an explicit session id, that file has to exist. If it does not, the command refuses to fabricate a new one. A typo on a UUID that points at a missing file does not produce a fresh empty session; that would be silently creating state the operator never asked for.

## `--rekey` and the "no overwrite without decrypt" rule

`--rekey` is the rotation flag. The shape is simple: read each file, decrypt it under the resolved key, encrypt it under the same resolved key, atomically replace. The interesting rule is what happens when the key is wrong.

The command refuses to overwrite a file it cannot decrypt. A wrong passphrase surfaces as the typed `SessionDecryptionError`, the file is left exactly as it was, and the process exits 1. There is no path where the command "helpfully" writes an empty file or a partially-decrypted envelope under the new key, because that would be the catastrophic failure: the placeholder map destroyed, the file still present, and the operator none the wiser until the next `rehydrate` returned nothing.

What this means in practice for rotation: to rotate from one passphrase to another, you need both. The first process reads under the old key and writes under the new key, because the file on disk is encrypted-OLD. The `--rekey` flag is not "switch keys"; it is "allow touching already-encrypted files." The key under which the file is written is whatever the resolver returns.

A common mistake is to assume `--rekey` accepts the new key only. It does not. A `--rekey` run with the wrong key surfaces the typed error and the file is untouched, which is the safe direction but might confuse an operator who expected "rotate to this new key" to work without the old one.

## The summary counts

The summary line at the end of a successful run has three counters, and the tail pieces only appear when the relevant counter is non-zero:

- `Encrypted N session(s).`: the plain happy path.
- `Encrypted N session(s), K already encrypted (use --rekey to rotate the passphrase).`: the file existed and was an envelope, but `--rekey` was not passed. The command did not touch the file. This is what you see on a second migration run.
- `Encrypted N session(s), M missing skipped.`: the file did not exist on disk. Only appears in the "all sessions" branch, where the operator did not pass an explicit id. A missing explicit id aborts the run with exit 1 instead of counting.

The split between "skipped explicit id" and "missing explicit id" is deliberate. Both are operator errors, both leave the on-disk state untouched, and both warrant a non-zero exit. By contrast, a missing id in the all-sessions branch is not really an operator error; the directory could have been mutated by another process between the listing and the encrypt loop. Counting and continuing is right there.

## The typed error path

The bigger change in v1.4.0 is `SessionDecryptionError`. Before this release, a session file that could not be parsed was renamed to `<id>.corrupt-<timestamp>` and the read returned an empty map. A wrong passphrase, a tampered auth tag, and a session that the TTL GC had quietly removed all looked identical: empty map, no error. That was bad, because each of those needs a different response.

The new shape splits it:

- Wrong passphrase or tampered ciphertext: `SessionDecryptionError` with the message `Unable to decrypt session. The encryption key may be incorrect or the session file may have been modified.` The message is intentionally ambiguous. From the cipher's perspective, those two failures are the same event, and giving the operator a more specific message would amount to an oracle.

- File is encrypted but no key has been resolved in this process: a different error earlier in `readSessionMap`, with a clearer message naming the two ways to fix it (`PROMPT_SCRUB_KEY` or `setCachedEncryptionKey()`).

- Session has been GC'd or the id is wrong: not a `SessionDecryptionError` at all. `readSessionMap` returns `{}` for a missing file, and `sessions show <id>` translates that to `Session <id> not found.` and exits 1.

That last split is the one most worth internalising. A `SessionDecryptionError` means the file is there and the bytes are not what we expected; either the operator mistyped a passphrase or something on disk is wrong. A `Session <id> not found.` means the file is gone and the issue is session lifecycle. Triaging the two used to be impossible because they looked the same; v1.4.0 makes them distinguishable.

## A worked rotation

```bash
# Step 1: enable encryption in the config
# ~/.config/prompt-scrub/config.json
# { "encryptionEnabled": true }

# Step 2: provision the OLD passphrase, run the initial migration
export PROMPT_SCRUB_KEY
read -rs PROMPT_SCRUB_KEY
prompt-scrub sessions encrypt
# Encrypted 12 session(s).

# Step 3: rotate the passphrase
export PROMPT_SCRUB_KEY
read -rs PROMPT_SCRUB_KEY  # the NEW passphrase this time
prompt-scrub sessions encrypt --rekey
# Encrypted 12 session(s).
# (reads each file under the OLD key on disk, writes under the NEW key)

# Step 4: spot-check
prompt-scrub sessions show <some-id>
# Should print the placeholder map; the file on disk should be an envelope.
```

If step 3 ever fails with `Unable to decrypt session...`, it means the key the resolver returned is not the old one, and nothing was written. The fix is to export the old passphrase, run `--rekey` under that, then export the new one and run it again. The two-pass shape is what keeps the rotation from ever being one-way.

Source, full docs, and the threat model live at:

https://github.com/Nano-Collective/prompt-scrubber
