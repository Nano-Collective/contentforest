---
product: prompt-scrub
version: "1.0.0"
channel: linkedin
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 1612
---

The secret detector in `prompt-scrub` ships with three layers, not one. A single regex covering every credential format is the obvious approach, and it does not work. Vendor token formats change (OpenAI alone has `sk-`, `sk-proj-`, `sk-svcacct-`, `sk-ant-api3-`), and any permissive enough pattern for catching real secrets will catch a lot of innocent high-entropy strings on the way past.

The shape we landed on is in `src/detectors/secret.ts`:

- Layer 1: a flat list of vendor prefix patterns. `ghp_`, `xoxb-`, `AKIA`, `AIza`, `ya29.`, the OpenAI `sk-` variants, AWS Lookbehind/lookahead boundaries to avoid mid-identifier false matches. These are deliberately high precision and accept some loss of coverage.
- Layer 2: a key value heuristic. When you see `API_KEY=...`, `password: ...`, `auth_token = ...`, the key name carries the signal and the value gets replaced. This is the workhorse for `.env` payloads, pasted shell history, and config dumps.
- Layer 3: a Shannon entropy gate at 4.5 bits per character, restricted to strings in suspect contexts (quoted, or after `=`). The safety net for credential shapes nobody has enumerated yet.

The threshold of 4.5 is the centre of the design. English prose sits around 4.1, so the gate skips it. A 32 character random base64 string lands around 5.0 to 5.5 and is caught. Raising the threshold would knock out real, padding heavy base64 credentials in exchange for fewer false positives on dictionary words, and the project's "missing a credential is worse than missing a name" policy operationalises that asymmetry on purpose.

All three layers write to the same `Finding` pool, then a final pass dedupes overlapping spans and keeps the longest match. At the package level, `SecretDetector` has the highest collision priority, so a URL with a token still gets the secret treatment.

Full write up on the three-layer design, including the actual patterns and the entropy code: https://github.com/Nano-Collective/prompt-scrubber
