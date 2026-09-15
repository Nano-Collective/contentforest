---
product: prompt-scrub
version: "1.4.0"
channel: linkedin
title: ""
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 2989
---

`prompt-scrub` v1.4.0 ships opt-in session encryption, and the migration story is the part worth slowing down on. The new `prompt-scrub sessions encrypt [id]` command is the path from "we left plaintext on disk for a while" to "every session file on this machine is wrapped in an AES-256-GCM envelope," and the rules around it are what keep that path reversible.

The headline behaviours, in plain language:

- The command refuses to run unless `encryptionEnabled: true` is in the config. There is no `--force`. The flag is what tells the rest of the system an envelope may appear at read time, and setting it is the operator's pre-condition.

- An explicit session id is treated as a contract. A typo does not produce a new empty session file. The command prints `Session <id> not found.` to stderr and exits 1. A freshly-minted empty file at the wrong path is indistinguishable from an expired session, and the failure direction the system never wants is the silent one.

- `--rekey` is the only path that touches already-encrypted files, and it demands the OLD passphrase. The command reads each file through `decryptSession` under the resolved key, then writes it through `encryptSession` under the same key. A wrong key surfaces as the typed `SessionDecryptionError`, the file is left as it was, and there is no path where the command overwrites a file it cannot decrypt.

- The summary line describes the run as `Encrypted N session(s).`, with optional tails `, K already encrypted (use --rekey to rotate the passphrase)` or `, M missing skipped`. Each tail appears only when the relevant counter is non-zero.

The bigger behaviour change is the typed `SessionDecryptionError`. Before this release, a session file that could not be parsed was renamed and the read returned an empty map. A wrong passphrase, a tampered auth tag, and a TTL-expired session all looked identical: empty map, no error.

The new shape splits that one failure into three. A wrong key or a tampered file produces `SessionDecryptionError` with the message `Unable to decrypt session. The encryption key may be incorrect or the session file may have been modified.` The ambiguity is the point: from the cipher's point of view those two failures are the same event, and a more specific message would amount to an oracle. A genuinely expired session is not a `SessionDecryptionError` at all. `readSessionMap` returns `{}` for a missing file, and `sessions show <id>` translates that to `Session <id> not found.` and exits 1. The two error shapes differ on purpose, so an operator triaging them can tell a key-or-bytes failure apart from a routine session-lifecycle event.

For library callers, `SessionDecryptionError` is exported from the package root. The full migration walkthrough, including the typed error shapes and a worked rotation example, is in the GitHub Discussion for this release.

Source, the threat model, and the full CLI reference live at:

https://github.com/Nano-Collective/prompt-scrubber
