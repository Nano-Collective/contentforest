---
product: prompt-scrub
version: "1.5.0"
channel: reddit
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 7729
---

Here is a decision we made in `prompt-scrub` that took a while to get right, and it is the kind of thing that only matters once you think about which way the failure goes.

`prompt-scrub` runs a dozen detectors over your text. Detectors overlap constantly. A URL contains a path. A path contains an email. A secret sits inside a JSON string that also has an API key in it. So the pipeline has to decide, for every pair of findings that claim the same characters, which one wins and what happens to the other one.

The old answer was: the higher-priority detector wins, the other one is thrown away. Simple, and for most overlaps correct. Two `Address` findings on the same text are rival readings of one address, and you want the better one.

But it is wrong in a case that matters. Sometimes the losing detector was over-broad, and the winning detector had no opinion at all about the part the loser had covered. Dropping the loser then drops that part of the text into the clear.

The case that made us look at this properly was the Windows path detector. A path with a space in it is genuinely ambiguous. `C:\Users\john smith\creds.json` is one path. `C:\app\cfg.ini owner` is a path and then a word. A detector that cannot be sure has to pick, and we picked "match more", because over-redaction is recoverable and a dropped tail is a leak.

The problem is that "match more" only works if the collision resolver cooperates. It used to not cooperate. The over-broad `Path` lost to the higher-priority `Email` sitting inside it, and the whole path finding got discarded, so the path text the detector was right about went out unredacted.

**The fix is to narrow the loser instead of dropping it.** The loser's span is sliced to the part the winner does not cover, and that remainder survives as its own finding. Here is the actual test:

```ts
const text = 'C:\\app\\cfg.ini owner alice@corp.com';
const emailStart = text.indexOf('alice@corp.com');
const overBroadPath = makeFinding('Path', 0, text.length, text);
const email = makeFinding('Email', emailStart, text.length, text.slice(emailStart));

const result = resolveCollisions([overBroadPath, email]);
// result[0].value === 'C:\\app\\cfg.ini owner'
// result[1].value === 'alice@corp.com'
```

Two findings out, not one. The path got narrowed to the region the email does not cover, and both survive.

It works the same way when the winner is in the middle, in which case the loser comes back in two pieces and the winner comes back in two as well:

```ts
const text = 'aaaa BBBB cccc';
const wide = makeFinding('Path', 0, text.length, text);
const inner = makeFinding('Secret', 5, 9, 'BBBB');

const result = resolveCollisions([wide, inner]);
// result.map((f) => f.value) === ['aaaa', 'BBBB', 'cccc']
```

This is the piece of the design that I like most. The rule is not "be careful not to over-match". The rule is "you are allowed to over-match, because the resolver will narrow you". Which means a detector can be aggressive without being dangerous, as long as the two ends of the pipeline agree on that contract. And they now do.

**A narrowed fragment is scored at 0.8 times the original.** The reasoning, from the source comment:

> A narrowed fragment is weaker evidence than the match it came from: it is the remainder of a span another, higher-priority finding has already contradicted, not a full match for whatever pattern gave the original its score. Attenuated by this factor so a filter downstream can tell the two apart, rather than the fragment inheriting the original's confidence as if nothing had happened to it.

So a `Path` at 0.90 becomes 0.72 when it gets narrowed. If you run with `--min-confidence 0.8`, the original would have cleared the threshold and the fragment does not. That is the intended behaviour. A fragment is the leftover of a match something else has partly disproved, so it should not carry the full confidence of a clean match.

One subtlety: a finding with no `confidence` field at all does not gain one. The code only rescales when the loser actually had a score:

```ts
if (loser.confidence !== undefined) {
  part.confidence = loser.confidence * NARROWED_CONFIDENCE_FACTOR;
}
```

That matters for rule packs written against the original `Detector` interface. They keep the default 0.5 rather than silently becoming 0.4.

**Two cases still drop the loser**, and both are deliberate. Same category, because two `Address` readings are the same entity, not one entity plus a remainder. The `10` in `10 Downing St, London` does not become its own Address finding. And a finding whose `value` is not exactly the text under its `span`, because there is nothing to re-slice:

```ts
if (loser.category === winner.category || loser.value.length !== loser.span[1] - loser.span[0]) {
  return [];
}
```

That second one is the one place where a dropped loser can still mean text goes out in the clear, so it is worth knowing about if you write rules. Your `value` has to be the literal text.

**The same release rewrote the resolver for speed**, and this is where it got interesting. The old implementation was quadratic in two separate places: collision resolution rescanned the whole accepted set for every finding, and the scrubbed text was rebuilt by re-slicing the whole string once per finding. A document with 10,000 findings took about 1.7 seconds. It now takes under 100 milliseconds.

Two changes:

- Findings come off a min-heap in start order, so the accepted set stays sorted and the collision is found by binary search instead of a scan. O(n log n) for disjoint findings, plus O(log n) per overlap.
- The output is rebuilt in one left-to-right pass, collecting slices and joining once. The placeholder numbering still runs right to left, because that is what makes the numbers come out in the order you expect, but the rebuild no longer re-slices the whole string per finding.

The claim we had to stand behind was "identical output". The way we stood behind it was to keep the old implementation verbatim as a test fixture and compare the new one against it:

```ts
// Copy of src/core/collision-resolver.ts from before it was rewritten for speed, with only
// the import path changed. The tests compare the current implementation with it: do not edit.
import { resolveCollisions as referenceResolveCollisions } from './fixtures/collision-resolver.reference.js';
```

The test runs 3,000 rounds of randomised findings, with random categories, random confidences, random locale markers and randomly malformed values, and asserts the two implementations agree deep-equal. That is a differential test against the code that shipped before, not a benchmark.

It also means the narrowing behaviour had to survive a performance rewrite, which was the part I was least sure about. Narrowing produces new findings, so a rewrite that assumed "filter or keep" would have quietly changed what gets redacted. The differential test caught that class of mistake for us.

**What this does not do.** Narrowing does not make a bad detector good. It changes what happens when a bad detector loses. A detector that over-matches and never loses still over-matches. It does not change the priority order either: Secret still beats everything, and a 0.60 entropy `Secret` still beats a 0.95 `Url` it sits inside. Confidence is not a tie-break within a priority level.

If you write rules for `prompt-scrub`, the three things worth remembering are: you are allowed to be over-broad, your confidence gets scaled down by 0.8 if you lose a collision, and your `value` must be the literal text under your `span`.

```bash
npm install -g @nanocollective/prompt-scrub
```

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
