---
product: prompt-scrub
version: "1.4.0"
channel: github-discussion
title: "Migrating plaintext sessions without locking yourself out"
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 18840
---

# Migrating plaintext sessions without locking yourself out

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The headline for `prompt-scrub` v1.4.0 announces that opt-in session encryption is here, and the two companion articles in this release walk underneath the envelope itself and through the key-supply path. This one stays at the operator level and walks through the `prompt-scrub sessions encrypt [id]` migration command: what it refuses to do, what the summary counts mean, and how the typed `SessionDecryptionError` makes the failure modes you actually hit (wrong key, tampered file, genuinely expired session) distinguishable instead of silently collapsing into one.

The migration is short, but the design rules behind it are the point. Every refusal and every summary line is a guard against a specific operator mistake, and the rest of this article goes through each one.

## The pre-flight checks, in order

The command is defined in `src/cli/commands/sessions.ts` and runs through three checks before touching any file:

1. `encryptionEnabled` must be true in the loaded config.
2. A key must resolve via the resolver (cache, then `PROMPT_SCRUB_KEY`, then TTY prompt).
3. The targets list must not be empty, and, if an explicit id was passed, the file must exist.

The first guard is a hard error. If the flag is off, the command prints `encryption is not enabled in the config file. Set "encryptionEnabled": true in ~/.config/prompt-scrub/config.json first.` to stderr and exits 1. There is no `--force` and no "encrypt anyway, set the flag yourself afterwards" mode. The reasoning is that without the flag set, the next `scrub` or `rehydrate` run would either fail to read the freshly-encrypted file (because no key is resolvable at runtime) or, worse, succeed in writing an encrypted file but then treat it as unparseable because the read path's `isEncryptedEnvelope` discriminator requires the key to be available in the same process. The flag is what makes the rest of the system behave correctly, and turning it on is the pre-condition the operator has to do themselves.

The second guard is `resolveEncryptionKeyOrExit()`. If the resolver ladder returns a key, the resolver caches it for the rest of the run. If any step throws, the resolver prints the message and exits 1. The interesting case is what counts as a failure here. `assertValidKey` rejects empty and whitespace-only strings, so `PROMPT_SCRUB_KEY=""` falls through to the TTY prompt, which then fails the `isTTY` check and prints the redirected-I/O message. The shape `export PROMPT_SCRUB_KEY; read -rs PROMPT_SCRUB_KEY` (where the env var is initially unset, then set by `read -rs`) works, but `export PROMPT_SCRUB_KEY=""` followed by `prompt-scrub sessions encrypt` fails loudly. Both behaviours are intentional; the second is the safe failure direction for a misconfigured caller.

The third guard is the part most worth understanding. The target list is `[id]` when an id is passed, and `listSessions().map((s) => s.id)` when it is not. The empty-targets branch prints `No sessions to encrypt.` and returns, with exit code 0. Nothing happened, but nothing failed either.

## Why an explicit id is treated as a promise

When `prompt-scrub sessions encrypt <id>` is run with a specific session id, the command treats that id as a contract: the file at `~/.config/prompt-scrub/sessions/<id>.json` must exist, and the command will not create it if it is missing. The relevant block:

```typescript
if (!sessionExists(sessionId)) {
  missing += 1;
  if (id) {
    console.error(`Session ${sessionId} not found.`);
    process.exit(1);
    return;
  }
  continue;
}
```

Two failure directions matter here. First, the loop never falls through to `writeSessionMap` for a missing id, so a typo like `prompt-scrub sessions encrypt 6f1c2b90-0d3a-4f8e-9a21` (truncated by one character) cannot produce a new empty session file. That would be the silent-failure direction the rest of the system works hard to avoid: a freshly-minted empty file is indistinguishable from an encrypted session that decrypted to `{}`, and both would show up in `sessions list` as a row with zero placeholders, which is also what an expired session looks like. Creating that file would be a fabricated state the operator never asked for.

Second, when the missing target was an explicit id, the command fails the run rather than continuing. The reason is symmetry with the other failure modes: a wrong-key `SessionDecryptionError` exits 1 and prints the offending session id; a missing input session id should be the same severity of failure, because both are operator errors and both leave the on-disk state untouched. Continuing past them would mean the summary line `Encrypted N session(s)` could reflect a run where one of the requested targets was not processed at all.

When the missing target is in the "all sessions" branch, the behaviour is different. A `listSessions()` that returns a stale or partially-deleted directory can include ids whose files have been removed by another process between the listing and the encrypt loop. Counting them as `missing` and continuing is the right call there, because the operator did not specifically request them; they were already known to the directory but happened to be gone. The summary reflects this:

```
Encrypted 12 session(s), 1 missing skipped.
```

The `missing skipped` tail appears only when `missing > 0` and no explicit id was passed, because the asymmetry is intentional.

## The encrypted / skipped / missing counts

The summary line at the end of a successful run describes three counters incremented inside the loop:

- `encrypted`: the file existed, was read and (re)written encrypted under the resolved key, and `writeSessionMap` did not throw. This is the "good" counter.
- `skipped`: the file existed and was already encrypted, but `--rekey` was not passed. The command did not touch the file.
- `missing`: the file did not exist on disk. In the explicit-id branch this aborts the run with exit 1; in the all-sessions branch this is counted and reported.

The `skipped` counter is the part that surprises people who run the migration twice. After the first run, every session on disk is encrypted, so the second run with no `--rekey` reports `Encrypted 0 session(s), N already encrypted (use --rekey to rotate the passphrase).` The zero is not an error; the migration already happened, and the second run is a no-op. The summary makes the state explicit by naming both halves of the result.

The `skipped` tail is suppressed when the operator passed an explicit id. The reasoning is the same as the missing case: an explicit id is a contract, and a skipped explicit id is the operator's cue to add `--rekey` if they actually meant a rotation, not to accept the silent no-op. The "all sessions" run, by contrast, is an inventory sweep, and the per-file state deserves to be in the summary.

A `SessionDecryptionError` thrown out of `readSessionMap` during the encrypt loop is treated the same as a missing explicit id: the offending id is printed to stderr, and the process exits 1. This catches the case where the operator ran the migration under one passphrase and then tried to re-run it under a different one without `--rekey`. The second run cannot read the file the first run wrote, so the typed error fires, the operator sees the message, and the on-disk state is unchanged.

## Why `--rekey` needs the OLD passphrase

`--rekey` is the rotation flag. It is the only path that re-encrypts an already-encrypted file, which is the right shape for a passphrase rotation: every file that was encrypted under the old key has to be read back under that key, then written under the new one, in a single process. The relevant code path is `readSessionMap` -> `writeSessionMap`, where the read goes through `decryptSession` with the currently-resolved key and the write goes through `encryptSession` with the same resolved key.

The implications fall out cleanly:

**You cannot rotate without the old key.** The command is documented as `prompt-scrub sessions encrypt --rekey`, but the implicit contract is that the resolver supplies the old passphrase, not the new one. A user who exports `PROMPT_SCRUB_KEY=newpass` and runs `--rekey` cannot decrypt the existing file, `readSessionMap` throws `SessionDecryptionError`, the command prints the typed error message and exits 1, and the file is left exactly as it was. There is no path where the command overwrites a file it could not read.

**The command never silently overwrites a file it cannot decrypt.** The `try { readSessionMap(...); writeSessionMap(...) }` block does not catch the read error and proceed to the write, because that would be the catastrophic failure mode: a partially-decrypted or empty write to a previously-encrypted file would silently destroy the placeholder map and leave only the encrypted envelope (now containing whatever `readSessionMap` returned, which is `{}` for an empty map) under the new key. The user would see a file at the path, no error from `sessions list`, and a `rehydrate` that returned empty output indistinguishable from a fresh session. Rejecting the read error and aborting is the only safe direction.

**The order of operations is read-then-write, not in-place encrypt.** `writeSessionMap` writes to a `*.tmp` sibling and `rename`s over the original, so a crash mid-write leaves either the old file or the new file, never a truncated intermediate. The whole rotation is two atomic filesystem operations per file: one write to a temp, one rename. A crash between the two leaves the old encrypted file in place and a stale `.tmp` behind; `writeSessionMap` does not clean up `.tmp` files on the encrypt path (the catch block only `unlink`s the temp when the rename failed), but a stale temp does not affect `readSessionMap` or `listSessions`, both of which filter on `.json`.

**Two `--rekey` invocations under different keys across two processes is the supported rotation pattern.** The first process resolves the old key, reads the file, re-writes it under the old key (a true no-op for the ciphertext but a fresh salt and IV), then exits. The second process resolves the new key, reads the file under the new key... wait, no. The way to actually rotate is the opposite: resolve the new key first, and the rotation will read the file under the old key (because that is what is on disk) and write under the new key. The `--rekey` flag is not a "switch keys" flag; it is an "allow touching already-encrypted files" flag. The key under which the file is written is whatever the resolver returns.

A worked example, with two rotations across two passes to make the read/write keys differ:

```bash
# Pass 1: provision the OLD passphrase via the env var, write under OLD.
# The "rotation" is the move from plaintext to encrypted-OLD.
export PROMPT_SCRUB_KEY=old-passphrase
prompt-scrub sessions encrypt --rekey    # touches plaintext + already-encrypted-OLD

# Pass 2: provision the NEW passphrase, write under NEW, read still uses OLD
# because that is what is on disk.
export PROMPT_SCRUB_KEY=new-passphrase
prompt-scrub sessions encrypt --rekey    # reads encrypted-OLD, writes encrypted-NEW
```

The "wrong key on a `--rekey` run" failure is the most useful thing this code path exercises in practice. An operator who resets the passphrase without realising the rotation needs the old one gets the typed error immediately, the file is not modified, and they can roll back by exporting the old passphrase and re-running.

## What the summary looks like in each branch

The summary line is a one-line, plain-English inventory of the run. A few real shapes:

```
$ prompt-scrub sessions encrypt
Encrypted 12 session(s).

$ prompt-scrub sessions encrypt
Encrypted 12 session(s), 3 already encrypted (use --rekey to rotate the passphrase).

$ prompt-scrub sessions encrypt --rekey
Encrypted 12 session(s).

$ prompt-scrub sessions encrypt 6f1c2b90-0d3a-4f8e-9a21-2b7c1e4d5a63
Encrypted 1 session(s).

$ prompt-scrub sessions encrypt 6f1c2b90-0d3a-4f8e-9a21
error: Session 6f1c2b90-0d3a-4f8e-9a21 not found.
# exit 1

$ PROMPT_SCRUB_KEY=wrong-key prompt-scrub sessions encrypt --rekey
Unable to decrypt session. The encryption key may be incorrect or the session file may have been modified.
# exit 1; on-disk state unchanged
```

The summary deliberately does not include a `rekeyed` count separate from `encrypted`. A `--rekey` run that re-writes an already-encrypted file under the same key increments `encrypted`, because the user asked for the re-write and got it. A `--rekey` run that re-writes under a new key also increments `encrypted`, because the file on disk is now under the new key and that is what the operator wanted. Splitting the count would suggest the two are different operations; they are not.

## The typed error path: wrong key, tampered file, expired session

The single most important behaviour change in v1.4.0 is the typed `SessionDecryptionError` raised by `decryptSession` in `crypto.ts`. Before v1.4.0, a session file that could not be parsed was quarantined by `quarantineCorruptFile` to `<path>.corrupt-<timestamp>` and the read returned `{}`. A wrong key, a tampered auth tag, and an empty map after decryption all looked identical to the caller: an empty map, with the file renamed out from under them. The operator who hit a real failure had no way to distinguish a passphrase typo from a corrupt file from a session that had simply been GC'd. Each of those requires a different response, and the old behaviour made them indistinguishable.

The new behaviour splits that one failure into three:

**Wrong key.** `decryptSession` derives a key with scrypt under the supplied passphrase and the on-disk salt. If the result is not the right key for the AES-256-GCM decipher, `decipher.final('utf8')` throws. The catch block in `decryptSession` swallows the raw error and re-throws a `SessionDecryptionError` with the message `Unable to decrypt session. The encryption key may be incorrect or the session file may have been modified.` The message is intentionally ambiguous; from the cipher's point of view a wrong key and a tampered ciphertext look the same, and giving the operator a more specific message would amount to an oracle that distinguishes them, which an attacker can use to refine an offline guess.

**Tampered file.** Same code path. The catch block fires whenever GCM's integrity check fails, which happens both when the auth tag does not match the key (wrong passphrase) and when it does not match the ciphertext (someone modified the file). The message says both, because the implementation cannot tell. An operator who sees this error on a file they have not touched can suspect tampering; an operator who sees it immediately after typing a passphrase they have not used before can suspect a typo. The split between the two is forensic, not cryptographic.

**No key available.** A different typed error fires earlier in `readSessionMap` when the file is an envelope but no key has been resolved in this process:

```
Session is encrypted but no key is available. Set PROMPT_SCRUB_KEY or call setCachedEncryptionKey() before reading the session.
```

That one is unambiguous: the file is encrypted, the process has no way to decrypt it, and the operator needs to set up the resolver. It does not fire from inside `decryptSession`, because by the time decryption starts the resolver has already been consulted.

**Genuinely expired session.** A session that the TTL GC has removed is not a `SessionDecryptionError` at all. `listSessions()` filters out files that do not exist, so a rehydrate against an expired session id reads an empty map (`readSessionMap` returns `{}` for a missing file), and the model output goes back to the user with all placeholders unresolved. The CLI's `sessions show <id>` path treats an empty map after a read as `Session <id> not found.` and exits 1. The operator sees the missing-id error, not a `SessionDecryptionError`, and that is the correct differentiator: the file is not there, the on-disk state is fine, and the session has aged out.

The asymmetry is the point. The new error type exists precisely so that a wrong key and a tampered file are reported the same way (because they should look the same to the cryptographer) but differently from "the file is fine, it has just been GC'd" (which is a routine event and should not look alarming). An operator triaging a `SessionDecryptionError` knows the file is still there and the issue is the key or the bytes. An operator triaging a `Session <id> not found.` knows the file is gone and the issue is session lifecycle. The two are no longer folded together.

## A short operational checklist

1. Confirm `encryptionEnabled: true` is in the config and that `PROMPT_SCRUB_KEY` resolves in the running shell (via `read -rs` or a secret-manager export; never inline on the command line).
2. Run `prompt-scrub sessions list` first. It asks for a key only when at least one file on disk is already encrypted, so passing the existing key keeps the listing working. Skipping this step is fine, but the listing is the cleanest sanity check that the resolver works in this process.
3. Run `prompt-scrub sessions encrypt` for the initial migration. Expect a one-line summary in the shape `Encrypted N session(s).` or `Encrypted N session(s), K already encrypted (use --rekey to rotate the passphrase).` The presence of `already encrypted` on the first run means some files were already migrated by a previous invocation.
4. To rotate the passphrase, export the new passphrase, run `prompt-scrub sessions encrypt --rekey`, and confirm the summary. The rotation reads under the old key and writes under the new one. A `SessionDecryptionError` here means the supplied key is not the old key, and the file on disk is unchanged.
5. Spot-check with `prompt-scrub sessions show <id>`. The output should be the placeholder map; the file on disk should be an envelope (`isEncryptedEnvelope` returns true). A `sessions show` that prints `{}` and exits 1 means the id is wrong, not that the file is unencrypted.

The migration is one CLI call, but the rules behind it are the rules that keep an irreversible-looking operation reversible. The `sessions encrypt` command never fabricates a session that is not there, never overwrites a file it cannot decrypt, and never hides the failure mode the operator actually needs to act on.

Source, the threat model, and the full CLI reference live at:

https://github.com/Nano-Collective/prompt-scrubber

Issues and PRs are welcome there. For the wider conversation about how the Nano Collective designs these defaults, the [Discord](https://discord.gg/ktPDV6rekE) is open.
