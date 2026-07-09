---
product: prompt-scrub
version: "1.0.0"
channel: reddit
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 2418
---

We just shipped `prompt-scrub v1.0.0` and we want to talk about the secret detector specifically, because it is the part of the system that had the most thinking put into it.

A single regex covering every credential format is the obvious approach and it does not work, for two reasons. Vendor token formats change without notice (OpenAI alone has shipped `sk-`, `sk-proj-`, `sk-svcacct-`, and `sk-ant-api3-` variants, with no shared grammar except the prefix), and any pattern permissive enough to catch real secrets also catches a lot of innocent high-entropy text. SHA sums, long random looking identifiers developers type without thinking, base64 fragments. So the detector is three layers, not one:

1. Vendor prefix patterns. A flat list of high-precision regexes (`ghp_`, `xoxb-`, `AKIA`, `AIza`, `ya29.`, the OpenAI `sk-` variants, plus a generic `Bearer` pattern). These are calibrated against known vendor formats and accept some loss of coverage in exchange for very low false positive rates.

2. A key value heuristic. When you see `API_KEY=...`, `password: ...`, `auth_token = ...`, the key name carries the signal (`key`, `secret`, `token`, `password`, `pass`, `pwd`, `api`, `auth`, `cred`, `credential`, `private`, `access` are all on the allowlist), the value carries the rest. This is the workhorse for `.env` payloads, pasted shell history, and config dumps.

3. A Shannon entropy gate at 4.5 bits per character. The safety net for credential shapes nobody has enumerated yet. Restricted to strings in suspect contexts (after `=`, or inside quotes) and to the credential friendly alphabet, because an entropy match in arbitrary prose would be a different layer entirely.

A few choices worth flagging:

- The 4.5 threshold is the centre of the design. English prose sits around 4.1, so the gate skips it. A 32 character random base64 string lands around 5.0 to 5.5 and is caught. We could raise it to suppress false positives, but doing so would knock out real, padding heavy base64 credentials in exchange for fewer matches on dictionary words. The project's stated policy "missing a credential is worse than missing a name" is operationalised here, on purpose.

- All three layers write findings into the same `Finding` pool. A final sort dedupes overlapping spans and keeps the longest match, so a string that clears both the key value heuristic and the entropy gate does not get double counted. At the package level, `SecretDetector` has the highest collision priority over every other detector, which matters when a URL contains a token.

- The detector is pure TypeScript with no ML, no network calls, and no model dependencies. It runs locally on every message including tool results, so the cost of scrubbing on every turn is bounded by the regex and the entropy calculation.

- We did not enumerate every vendor format. There are deliberate gaps in the prefix list, because the prompt will go stale. Layers 2 and 3 exist to catch the shapes we have not seen yet, and the full file is short (around 100 lines with comments) so a maintainer can review and adjust the patterns.

The full write up with the actual patterns and the entropy code is on the GitHub Discussion that goes with this release: https://github.com/Nano-Collective/prompt-scrubber

If you have a credential shape that is slipping through (we want to know), or a false positive you would like us to address (we want to know that too), issues and PRs are welcome at the same repo. We hang out in the Nano Collective Discord if you would rather talk about it: https://discord.gg/ktPDV6rekE
