---
product: prompt-scrub
version: "1.5.0"
channel: github-discussion
title: "Over-redact, never leak: how collision resolution actually works"
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 19029
---

`prompt-scrub` runs a dozen detectors over your text and then has to decide what to do when two of them claim the same characters. This post is about that decision, because it is the part of a scrubber where the failure modes are asymmetric in a way that matters.

The asymmetry: a scrubber that redacts too much is annoying. A scrubber that redacts too little sends someone's email address to a cloud provider. Over-redaction is recoverable by hand. A leak is not recoverable once it is upstream.

v1.5.0 changed how collisions resolve. The change is worth understanding if you write rules or tune a threshold.

## The old behaviour: the loser was discarded

When two detectors flagged overlapping spans, the higher-priority one won and the other was thrown away. That is the obvious implementation, and it is what the resolver did for a long time.

The problem is that the losing finding was not always redundant. It was sometimes right about a region the winner knew nothing about.

Consider the Windows path detector. Paths with spaces are genuinely ambiguous. `C:\Users\john smith\creds.json` is one path. `C:\app\cfg.ini owner` is a path followed by a word. A detector that cannot be sure has to pick, and the one `prompt-scrub` picked was to match more:

> Where a path is genuinely ambiguous the detector errs towards matching more, since collision resolution narrows an over-broad `Path` against any email or secret inside it - over-redaction is recoverable, a dropped tail is a leak.

That sentence describes the design that v1.5.0 shipped. It did not describe v1.4.0, where collision resolution dropped the over-broad `Path` entirely in favour of the higher-priority finding inside it. The tail of the path, the part the `Path` detector was right about and the `Email` detector had no opinion on, went out in the clear.

Narrowing is the fix. The loser's span is not thrown away. It is sliced to the part the winner does not cover, and that remainder survives as its own finding.

## What "narrowed" means concretely

The clearest case is an over-broad path with an email sitting inside it:

```ts
const text = 'C:\\app\\cfg.ini owner alice@corp.com';
const emailStart = text.indexOf('alice@corp.com');
const overBroadPath = makeFinding('Path', 0, text.length, text);
const email = makeFinding('Email', emailStart, text.length, text.slice(emailStart));

const result = resolveCollisions([overBroadPath, email]);
// result[0].value === 'C:\\app\\cfg.ini owner'
// result[1].value === 'alice@corp.com'
```

Two findings come out, not one. The `Path` finding was over-broad and lost to the `Email`, so it was narrowed to `C:\app\cfg.ini owner`, the region the email does not cover. The email survives untouched.

Before this change, `C:\app\cfg.ini owner` was simply not redacted, because the `Path` finding that covered it had been discarded.

The same thing happens when the winner sits in the middle of the loser, so the loser comes back in two pieces:

```ts
const text = 'aaaa BBBB cccc';
const wide = makeFinding('Path', 0, text.length, text);
const inner = makeFinding('Secret', 5, 9, 'BBBB');

const result = resolveCollisions([wide, inner]);
// result.map((f) => f.value) === ['aaaa', 'BBBB', 'cccc']
```

Note that the winner in the middle also comes back split. `aaaa` and `cccc` are two separate findings, and the middle `BBBB` is the secret. Three findings for what started as two.

The invariant that matters: every surviving finding still describes exactly the text under its own span, and the resolved findings are always pairwise non-overlapping. The tests assert both over nested, staggered, abutting, identical and same-category shapes.

That is not a nicety. `scrub` replaces placeholders right to left, and right-to-left replacement is only correct while the spans do not overlap. Narrowing adds findings rather than only filtering them, so the invariant has to be asserted directly rather than assumed.

## Why a narrowed fragment is scored at 0.8 times the original

The narrowed fragment does not keep its original confidence. It is attenuated by a fixed factor:

```ts
const NARROWED_CONFIDENCE_FACTOR = 0.8;
```

The reasoning is in the source comment, and the reasoning is the whole point:

> A narrowed fragment is weaker evidence than the match it came from: it is the remainder of a span another, higher-priority finding has already contradicted, not a full match for whatever pattern gave the original its score. Attenuated by this factor so a filter downstream can tell the two apart, rather than the fragment inheriting the original's confidence as if nothing had happened to it.

So the fragment keeps 80% of the original score, and the original score keeps its meaning. A `Path` finding at 0.80 that gets narrowed becomes 0.64. A `Path` finding at 0.90 becomes 0.72.

The practical effect is on `--min-confidence`. A threshold set at 0.8 would have let the original path through. It does not let the narrowed fragment through, because 0.64 is below the threshold. That is the intended behaviour: the fragment is the leftover of a match that something else has already partly disproved. If your threshold says "only redact things I am at least 80% sure about", a fragment that survived only because the rest of its span was contradicted should not clear that bar.

The other half of the rule is that a finding with no confidence does not gain one. The code only overwrites the score when the loser actually had one:

```ts
if (loser.confidence !== undefined) {
  part.confidence = loser.confidence * NARROWED_CONFIDENCE_FACTOR;
}
```

A `Finding` from a rule pack written against the original `Detector` interface has no `confidence` field, and the resolver does not hand it one. It stays at the default confidence of 0.5 that the pipeline assigns, and it does not silently become 0.4.

This is worth flagging because it interacts with the filtering guarantee. `minConfidence` filtering runs before collision resolution, so a discarded low-confidence finding can never mask a higher-confidence one that overlaps it. That guarantee is about filtering only. Two findings that both clear the threshold still resolve by detector priority, not by confidence. A 0.60 entropy `Secret` can still win over a 0.95 `Url` it sits inside.

## The two exceptions where the loser really is dropped

Narrowing does not apply in every case, and both exceptions are deliberate.

**Same category.** Two `Address` findings over the same text are rival readings of one entity, not one entity plus a remainder. There is no "the part the winner does not cover" that means anything, because both are claiming to be the same address at different offsets. The winner's span is taken as authoritative:

```ts
const text = '10 Downing St, London';
const short = makeFinding('Address', 0, 13, text.slice(0, 13));
const long = makeFinding('Address', 3, text.length, text.slice(3));

const result = resolveCollisions([short, long]);
// result.length === 1, value === 'Downing St, London'
```

The `10` does not become its own Address finding. It is the same address, read badly, by the same detector.

**A value that does not map 1:1 onto its span.** If the finding's `value` is not literally the text under its span, there is nothing to re-slice. A normalised value cannot be sliced back into place, so the loser is dropped rather than narrowed:

```ts
if (loser.category === winner.category || loser.value.length !== loser.span[1] - loser.span[0]) {
  return [];
}
```

That is the one place where a dropped loser can still mean text goes out in the clear. The condition is tight: the value has to be exactly as long as the span. The resolver checks it, and it only fires for a finding that does not represent its own span.

## What else narrowing depends on: priority

Narrowing decides what happens to the loser. Priority decides who is the loser.

The order in v1.5.0 is:

1. `SecretDetector`
2. `CreditCardDetector`
3. `IbanDetector`
4. `SsnDetector`
5. `EmailDetector`
6. `UrlDetector`
7. `PathDetector`
8. `IpAddressDetector`
9. `PhoneDetector`
10. `AddressDetector`
11. `NameDetector`
12. `CodeTellDetector`

Lower number wins. Anything not in the table falls to 99.

Secret is first because missing a credential is worse than missing a name. The new detectors sit above `Email` and `Url` so that a run of digits that used to become `«Phone_N»` can now become `«CreditCard_N»` or `«Ssn_N»`. `IpAddress` sits below `Url`, so an IP inside a URL stays part of the `«Url_N»` and is not split out.

There is one priority subtlety, for locale-scoped detectors. A locale-scoped finding can displace the generic built-in of the same category, so a `de-DE` rule pack can correct an English-shaped `AddressDetector` match. But it can only do that when it covers the finding it displaces, or more:

```ts
function covers(outer: Finding, inner: Finding): boolean {
  return outer.span[0] <= inner.span[0] && outer.span[1] >= inner.span[1];
}
```

If the locale-scoped finding covers less, it loses outright rather than falling through to the longest-span tie-break. The reason is the same asymmetry as everywhere else in this post: preferring a finding that redacts less than the one it would displace would expose text that used to be replaced. This applies to a partial overlap, not just strict containment.

## The rewrite: O(n log n), 1.7 seconds to under 100 milliseconds

Here is the part that changed in v1.5.0 for performance, and the reason it is worth mentioning in a post about narrowing is that the rewrite had to preserve narrowing exactly.

The old resolver was quadratic. Two separate problems:

1. Collision resolution rescanned the whole accepted set for every finding, looking for an overlap.
2. The scrubbed text was rebuilt by re-slicing the whole string once per finding.

The changelog entry:

> Fixed a document with many findings stalling the scrubber. Collision resolution rescanned the whole accepted set for every finding, and the scrubbed text was rebuilt by re-slicing the whole string once per finding, so a document with 10,000 findings took about 1.7 seconds; it now takes under 100 milliseconds, with identical output. Closes #175.

### Fixing the scan: a heap and a binary search

The rewrite keeps a min-heap of findings ordered by start position, with insertion order as the tiebreak so it behaves like a stably sorted queue:

```ts
class FindingQueue {
  push(finding: T): void { /* sift up */ }
  pop(): T | undefined { /* sift down */ }
  private before(a: number, b: number): boolean {
    return x.finding.span[0] !== y.finding.span[0]
      ? x.finding.span[0] < y.finding.span[0]
      : x.seq < y.seq;
  }
}
```

Candidates come off the heap in start order, so the accepted set is kept sorted and the finding a candidate collides with is found by binary search rather than a scan:

```ts
function firstOverlap(accepted: Finding[], candidate: Finding): number {
  let lo = 0;
  let hi = accepted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (accepted[mid]!.span[1] > candidate.span[0]) hi = mid;
    else lo = mid + 1;
  }
  return lo < accepted.length && accepted[lo]!.span[0] < candidate.span[1] ? lo : -1;
}
```

`accepted` is sorted by start and pairwise non-overlapping, so its ends are sorted too. The first finding that ends after the candidate starts is the only one that can be leftmost, and it overlaps only if it also starts before the candidate ends. That is the whole reason the binary search is correct rather than approximately correct.

The accepted set is kept sorted with a binary-search insertion:

```ts
function insertSorted(accepted: T[], finding: T): void {
  const last = accepted[accepted.length - 1];
  if (last === undefined || last.span[0] <= finding.span[0]) {
    accepted.push(finding);
    return;
  }
  let lo = 0;
  let hi = accepted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (accepted[mid]!.span[0] <= finding.span[0]) lo = mid + 1;
    else hi = mid;
  }
  accepted.splice(lo, 0, finding);
}
```

That gives O(n log n) for findings that do not overlap, plus O(log n) per overlap.

### Fixing the rebuild: one left-to-right pass

The second half was in `scrub.ts`, and it is the simpler of the two. The old code rebuilt the output by slicing the whole string for every finding. The new code collects the pieces and joins once:

```ts
// Placeholders are minted right-to-left, which fixes how they are numbered. The
// text is then rebuilt in one left-to-right pass: slicing the whole string for
// every finding is quadratic in the number of findings.
const placeholders: string[] = new Array(findings.length);
for (let i = findings.length - 1; i >= 0; i--) {
  const finding = findings[i]!;
  placeholders[i] = session.createPlaceholder(finding.placeholderPrefix, finding.value);
}

const parts: string[] = [];
let cursor = 0;
findings.forEach((finding, i) => {
  parts.push(text.slice(cursor, finding.span[0]), placeholders[i]!);
  cursor = finding.span[1];
});
parts.push(text.slice(cursor));

return parts.join('');
```

Numbering still runs right to left, because that is what makes the placeholder numbers come out in the order you would expect. The rebuild then runs left to right, because that is what makes it linear. The two directions are doing different jobs.

### Why "identical output" is the claim that matters

The rewrite was not allowed to change what gets redacted. So the old implementation was kept, verbatim, as a test fixture:

```ts
// Copy of src/core/collision-resolver.ts from before it was rewritten for speed, with only
// the import path changed. The tests compare the current implementation with it: do not edit.
import { resolveCollisions as referenceResolveCollisions } from './fixtures/collision-resolver.reference.js';
```

And the new implementation is compared against it on random input, thousands of rounds, with random categories, random confidences, random locale markers and randomly malformed values:

```ts
test('gives the same result as the original implementation on random input', (t) => {
  // 3000 rounds of randomised findings, including findings whose value does
  // not map 1:1 onto their span, compared deep-equal against the reference.
});
```

That is the guarantee behind "identical output". It is not a benchmark result, it is a differential test against the implementation that shipped before.

The performance tests are separate, and they are wall-clock assertions with a generous budget:

```ts
test('resolves tens of thousands of disjoint findings quickly', (t) => {
  const findings = Array.from({ length: 20_000 }, (_, i) => makeFinding('Email', i * 20, i * 20 + 15));
  const start = Date.now();
  const result = resolveCollisions(findings);
  t.is(result.length, 20_000);
  t.true(Date.now() - start < 1000, `took ${Date.now() - start}ms`);
});
```

20,000 disjoint findings under a second. And an overlapping case that checks the priority is still right after the narrowing:

```ts
test('resolves thousands of overlapping findings quickly and keeps the higher priority', (t) => {
  // 3000 Url/Email pairs, each overlapping
  t.is(result.filter((f) => f.category === 'Email').length, 3_000);
  t.is(result.filter((f) => f.category === 'Url').length, 6_000);
});
```

Six thousand URL fragments from three thousand overlapping URLs, because each URL is split around the email inside it. That count is the narrowing behaviour showing up in a performance test.

## Termination, and why the resolver uses a queue

One structural detail worth naming, because it looks like a bug if you do not know why it is there.

The resolver does not do a single pass over the findings. It uses a work queue. The comment:

> A work queue rather than a single pass: narrowing can produce a part that starts to the right of findings still waiting, so a candidate is no longer guaranteed to meet at most one accepted finding. Anything unsettled goes back on the queue and is re-compared until it overlaps nothing.

When a candidate loses, its remainder is pushed back onto the queue rather than accepted directly, because that remainder may still collide with something else:

```ts
if (candidateWins(candidate, existing)) {
  accepted.splice(overlapIdx, 1);
  queue.push(candidate);
  for (const part of subtract(existing, candidate)) queue.push(part);
} else {
  for (const part of subtract(candidate, existing)) queue.push(part);
}
```

And when a candidate wins, the winner itself is requeued too, because it may now overlap something that was previously settled. A candidate always settles against the leftmost overlapping accepted finding, so the outcome does not depend on the order findings happened to land in the accepted set.

Termination is guaranteed by a measure that strictly decreases on every resolution: the total span length across the queue and the accepted set. Every overlap either removes a finding outright or replaces one with strictly shorter parts, so the measure cannot decrease forever.

## What this means if you write rules

Three practical consequences.

**Your detector can be over-broad without leaking.** If you write a rule that matches more than it should, the excess does not disappear. It becomes its own redacted fragment, and the text under it is still replaced. The cost is over-redaction, which is visible and fixable. This is why the path detector can afford to match more when a path is ambiguous.

**Your rule's confidence means something slightly different after a collision.** If your finding loses and is narrowed, the surviving fragment carries 0.8 times your score. If you set a `--min-confidence` threshold, some of your findings will drop below it once they have been narrowed by a higher-priority detector. That is intended. It is the signal that the finding was a remainder rather than a clean match.

**Your rule must map its value onto its span.** If your finding's `value` is not exactly the text under its `span`, it cannot be narrowed, and it is dropped when it loses. That is a real leak risk for a rule that normalises the value it reports.

## What this does not do

Narrowing does not make a bad detector good. It changes what happens when a bad detector loses. A detector that over-matches and never loses still over-matches.

It does not fix a detector whose value does not map onto its span, because the resolver cannot re-slice text it cannot locate.

It does not change the priority order. Secret still beats everything, and a 0.60 entropy `Secret` still beats a 0.95 `Url` it sits inside. Confidence is not a tie-break within a priority level.

And it does not make the tool understand your content. It works on spans. The best a scrubber can do with an over-broad rule is redact the part it got wrong.

```bash
npm install -g @nanocollective/prompt-scrub
```

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
