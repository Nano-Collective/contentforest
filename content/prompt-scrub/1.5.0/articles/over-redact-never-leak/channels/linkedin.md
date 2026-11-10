---
product: prompt-scrub
version: "1.5.0"
channel: linkedin
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 2820
---

A scrubber has two ways to fail and only one of them is annoying.

Redacting too much costs you a placeholder and some retyping. Redacting too little sends an email address to a cloud provider. `prompt-scrub` v1.5.0 is built around that asymmetry, in the part of it most people never see.

When two detectors claim the same characters, one has to win. The old behaviour was to discard the loser entirely. That is fine when the two findings are rival readings of the same thing, but it is not fine when the losing detector was over-broad and the winner knew nothing about the region the loser had covered.

Take a Windows path. `C:\app\cfg.ini owner` is a path followed by a word, and a detector that cannot tell the difference has to pick a side. If it matches more and there happens to be an email address further along the line, the email wins the collision under the old rules, and the path tail went out in the clear.

Now the loser is narrowed instead of dropped. It is sliced to the part of its span the winner does not cover, and that remainder survives as its own finding. So the path comes back as `C:\app\cfg.ini owner` and the email comes back as the email, and both get replaced. The over-broad detector degraded into over-redaction instead of a leak.

Two details worth knowing if you tune `--min-confidence`.

A narrowed fragment is scored at 0.8 times the original confidence. It is weaker evidence than a clean match, because it is the leftover of a span that a higher-priority detector has already partly contradicted. A path at 0.90 becomes 0.72, which means a threshold that would have cleared the original will not clear the fragment. That is the point: a downstream filter can tell a remainder apart from a real match. A finding with no confidence at all does not gain one.

And two cases still drop the loser outright. Same category, because two address readings are the same entity rather than one entity plus a remainder. And a finding whose value is not exactly the text under its span, because there is nothing to re-slice.

The same release also rewrote the resolver for speed. It used to rescan the accepted set for every finding and rebuild the text by re-slicing the whole string once per finding, so a document with 10,000 findings took about 1.7 seconds. It now runs in O(n log n): binary search over a sorted accepted set, output rebuilt in one left-to-right pass. Under 100 milliseconds, with identical output.

Identical output is the load-bearing claim. The old implementation was kept verbatim as a test fixture, and the new one is compared against it on thousands of rounds of randomised findings. It is a differential test, not a benchmark claim.

```bash
npm install -g @nanocollective/prompt-scrub
```

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
