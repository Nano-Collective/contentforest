---
product: prompt-scrub
version: "1.0.0"
channel: github-discussion
title: "How the secret detector catches what regexes miss"
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 7214
---

# How the secret detector catches what regexes miss

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

`prompt-scrub` ships eight detectors, but only one of them gets the highest collision priority and a stated "missing this is worse than missing a name" policy. This post is a behind the scenes look at `SecretDetector` (`src/detectors/secret.ts`): the three layer design (vendor prefix patterns, a key value heuristic, and a Shannon entropy gate), why the layers stack the way they do, and where each one deliberately gives up.

If you have ever pasted a credential into a prompt by accident, you will know why this detector exists. The problem is not "we have no detection", it is that naive regexes miss real keys and produce embarrassing false positives on innocent text. The shape we ended up with is the one that needed both.

## Why three layers, not one

A single regex covering every credential format is the obvious approach and it does not work. Two reasons.

Vendor tokens have formats that change without notice. OpenAI has shipped `sk-`, `sk-proj-`, `sk-svcacct-`, and `sk-ant-api3-` variants, with no shared grammar except the prefix. Generic providers routinely invent their own and rotate them. Any pattern that tries to enumerate them all is necessarily stale by the time it ships.

Conversely, high entropy alphanumeric strings appear everywhere in normal prose once you have a permissive enough pattern. A regex like `[A-Za-z0-9]{32,}` matches a surprising amount of identifiers, hashes, and base64 fragments that are not secrets at all, including SHA sums, license keys, file paths, and the kind of long random looking strings a developer types without thinking.

So the detector splits the work.

1. **Vendor prefix patterns** catch the credential shapes we know about with very high precision. If a string starts with `ghp_`, `xoxb-`, `AKIA`, `AIza`, `ya29.`, or one of the OpenAI `sk-` variants, it is almost certainly a token. No entropy calculation needed.
2. **A key value heuristic** catches credentials whose vendor shape we do not recognise, as long as they appear in a context that says "I am a secret". `API_KEY=...`, `password: ...`, `auth_token = ...`. The key name carries the signal, the value carries the rest.
3. **A Shannon entropy gate** catches high entropy strings that show up in suspect contexts (quoted, or after `=`) even when there is no recognisable prefix and no obvious key name. This is the safety net for secret shapes we have never seen before.

Each layer compensates for the others' gaps. The headline policy "missing a credential is worse than missing a name" shows up here as: Layer 1 wins on precision, Layer 3 wins on recall, and the secret detector gets priority over every other detector even when the spans overlap.

## Layer 1: known vendor prefixes

The first layer is a flat list of regular expressions, one per vendor format we want to recognise with high precision. The current list lives in `PREFIX_PATTERNS` at the top of `secret.ts`:

```ts
{ regex: /sk-(?:proj-|svcacct-|ant-api\d+-)?[A-Za-z0-9_-]{20,80}/g, name: 'OpenAI/Anthropic key' },
{ regex: /ghp_[A-Za-z0-9]{36}/g,                              name: 'GitHub PAT' },
{ regex: /gho_[A-Za-z0-9]{36}/g,                              name: 'GitHub OAuth' },
{ regex: /github_pat_[A-Za-z0-9_]{82}/g,                       name: 'GitHub fine-grained PAT' },
{ regex: /xoxb-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{24}/g,         name: 'Slack bot token' },
{ regex: /xoxp-[0-9]{11}-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{32}/g, name: 'Slack user token' },
{ regex: /AIza[0-9A-Za-z\-_]{35}/g,                           name: 'Google API key' },
{ regex: /ya29\.[0-9A-Za-z\-_]{60,200}/g,                     name: 'Google OAuth token' },
{ regex: /(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])/g,      name: 'AWS Access Key ID' },
{ regex: /(?:Bearer|bearer)\s+([A-Za-z0-9\-._~+/]{20,}={0,2})/g, name: 'Bearer token' },
```

A few details worth noting:

- The OpenAI pattern handles the new `sk-proj-`, `sk-svcacct-`, and `sk-ant-api3-` shapes in a single regex with an optional non capturing prefix block. We did not want four separate patterns that all need to be updated together when a new shape ships.
- The AWS pattern uses lookbehind and lookahead assertions, `(?<![A-Z0-9])` and `(?![A-Z0-9])`, so it does not match inside a longer alphanumeric identifier. Without those, `AKIAIOSFODNN7EXAMPLE` would also match inside `FOOAKIAIOSFODNN7EXAMPLEBAR`, which is not a token.
- The Bearer token pattern captures only the token portion via a group, so the `Authorization: Bearer ` prefix does not get wrapped into the placeholder span.
- Length constants matter. `[A-Za-z0-9]{20,80}` is not a sniff at "any random string"; it is calibrated to the real minimum lengths of the keys these vendors issue, and the upper bound rejects absurd matches (a 500 character sk- blob is almost certainly text from somewhere else).

These patterns deliberately accept some loss of coverage in exchange for very low false positive rates. A token format we have never seen before is what Layer 3 is for.

## Layer 2: the key value heuristic

Many real credentials do not start with a recognisable prefix. Internal services, self-issued tokens, less common cloud providers. They look like ordinary alphanumeric strings until the surrounding text gives them away.

Layer 2 looks for assignments of the form `KEY=value` or `KEY: value`, then checks whether the key name itself implies secrecy. The pattern is two lines:

```ts
const SECRET_KEY_NAMES =
  /(?:key|secret|token|password|pass|pwd|api|auth|cred|credential|private|access)[_-]?(?:id|key|secret|token)?/i;
const KV_PATTERN = /(?:^|[\s,;{])([a-zA-Z0-9_.-]+)\s*[:=]\s*["']?([A-Za-z0-9+/\-_.~@]{8,})["']?/gm;
```

A few choices worth unpacking:

- The `KV_PATTERN` requires a value of at least 8 characters of "credential alphabet" characters (`A-Z`, `a-z`, `0-9`, `+`, `/`, `-`, `_`, `.`, `~`, `@`). This eliminates short flags like `PORT=8080` and values that contain punctuation out of the credential space.
- `SECRET_KEY_NAMES` is intentionally a wide allowlist of key name fragments (`key`, `secret`, `token`, `password`, `pass`, `pwd`, `api`, `auth`, `cred`, `credential`, `private`, `access`), combined with optional suffixes (`_id`, `_key`, `_secret`, `_token`). The wide allowlist is the point: a key named `redis_url` is not in the list, but `redis_secret` is, and that is the line we want to draw.
- Only the value, not the key, is replaced. The reasoning is twofold. Rehydrating `redis_secret=Redis_1` would expose the key name to the cloud LLM in a way the scrubber cannot fix, and the original value is the part that matters for rehydration anyway.

This layer is the workhorse for `.env`-shaped payloads: configuration dumps, pasted shell history, pasted config snippets. It is also the most likely layer to occasionally produce a false positive on something innocent, like `author: helloworld` in a config file. We accept that trade. The alternative (only fire on Layer 1 patterns) leaks self-issued credentials, which is the failure mode we are most worried about.

## Layer 3: the entropy gate

When neither the prefix nor the key name is recognisable, Layer 3 is the safety net. It scans for high entropy strings that appear in suspect contexts (after `=`, or inside quotes) and fires the Shannon entropy gate at 4.5 bits per character.

```ts
const HIGH_ENTROPY_PATTERN = /(?:=|["'])([A-Za-z0-9+/]{20,})(?:["']|={0,2}(?!\w))/g;

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] ?? 0) + 1;
  }
  return Object.values(freq).reduce((e, count) => {
    const p = count / str.length;
    return e - p * (Math.log(p) / LOG2);
  }, 0);
}
```

And the gate, in one line:

```ts
if (shannonEntropy(value) < 4.5) continue;
```

The 4.5 threshold is the centre of the design. It is high enough to skip ordinary text (English prose is around 4.1 bits per character for a clean sample) and low enough to catch real secrets (a 32 character random base64 string sits around 5.0 to 5.5). Where Layer 1 was an explicit vendor allowlist, Layer 3 is a probabilistic filter that fires on something looking much more like randomness than natural text.

Two important constraints around the gate:

- The string has to be at least 20 characters of `[A-Za-z0-9+/]` (the credential friendly alphabet). This excludes short tokens and most human words.
- The string has to appear in a suspect context: after `=`, inside double or single quotes, or otherwise `=`-shaped. An entropy match in arbitrary prose would be a different layer entirely, and we did not want this one to fire on it.

The shape of the test suite reflects the trade. `SecretDetector` tests assert that ordinary prose produces nothing, that `PORT=8080` produces nothing (length constraint), and that `color = "aaaaaaaaaaaaaaaaaaaaaaaaa"` produces nothing (entropy constraint). What survives is what we wanted to catch.

## Overlaps and priority

All three layers write their findings into the same `Finding` pool. The final sorting pass dedupes overlapping spans and keeps the longest match:

```ts
for (const candidate of raw) {
  const overlapIdx = findings.findIndex(
    (existing) => candidate.span[0] < existing.span[1] && candidate.span[1] > existing.span[0],
  );
  if (overlapIdx === -1) {
    findings.push(candidate);
  } else if (candidate.value.length > (findings[overlapIdx]?.value.length ?? 0)) {
    findings[overlapIdx] = candidate;
  }
}
```

A concrete case: a long base64 string inside a key value pair might match both the key value heuristic (because the key name says it is a secret) and the entropy gate (because the value clears 4.5 bits per character). The sorting pass keeps the longer span so the same value is not double counted, and the secret detector as a whole gets priority over every other detector at the package level (`SecretDetector` → `EmailDetector` → `UrlDetector` → … in `docs/features/detectors.md`), which matters when a URL contains a token.

## What we deliberately did not do

Two design choices we held the line on, both worth explaining.

We did not add an ML based classifier. The detector runs locally on every message; calling out to a model would defeat the point. A pure deterministic implementation, fast enough to scrub every tool result on every turn, was the bar.

We did not raise the entropy threshold to suppress false positives. The "missing a credential is worse than missing a name" policy is operationalised here. Raising the threshold from 4.5 to 5.0 would knock out a noticeable number of real (low entropy, padding heavy) base64 credentials in exchange for fewer false positives on things like dictionary words. The current setting accepts that asymmetry on purpose.

## Where to look in the code

The full file is short, around 100 lines including comments. The layers are visually separated by banner comments, so reading order is `PREFIX_PATTERNS`, `KV_PATTERN`, `HIGH_ENTROPY_PATTERN`, then the three `while` loops that emit findings. The dedupe pass at the bottom is the same priority logic the rest of the codebase uses.

Tests live next to it: `tests/detectors/secret.test.ts`. Each layer has positive and negative cases that exercise the boundary in plain English (`does not match ordinary words`, `does not match a short value in a key=value pair`, `does not match low-entropy value in quotes`).

## A note on tuning

The PREFIX_PATTERNS list will drift. Vendors rotate token formats; we will need to follow them. The threshold of 4.5 is a number we calibrated by hand against a small corpus and it will need to move as the corpus moves. Both are honest about being open to change while the package is at 0.x, which `prompt-scrub v1.0.0` still is for all purposes that depend on detector coverage.

If you have a credential shape that is slipping through (we want to know), or a false positive you would like us to address (we want to know that too), the package is at the repo below. Both pieces of information are equally useful for tuning this detector.

Source, tests, and the full SecretDetector implementation: https://github.com/Nano-Collective/prompt-scrubber
