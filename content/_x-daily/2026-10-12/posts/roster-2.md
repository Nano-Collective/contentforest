---
kind: x-daily
date: "2026-10-12"
source: "roster"
channel: x
angle: "Review gate is off unless you opt in"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 279
---
The rule that blocks a staff App from merging its own PR is Roster (alpha)'s `review_gate`, and it ships off. Flip it on in `org.yaml`: `roster doctor` fails any repo without an approving review; `roster hire --apply` writes the `roster: review before merge` ruleset.