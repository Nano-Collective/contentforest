---
kind: personal
member: will
channel: instagram
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-10T21:59:28.274Z"
model: "minimax-m2.7"
char_count: 552
---

v1.26.0 ships reasoning trace streaming for reasoning models — but the first implementation had bugs.

Control+R wasn't restoring reasoning on follow-up turns. GPT-5 reasoning wasn't rendering at all. And thinking content was leaking into output after a tool ran.

All fixed now. Three control points — Control+R, Display Settings, and the tune menu.

Available in Nanocoder v1.26.0. More soon.
