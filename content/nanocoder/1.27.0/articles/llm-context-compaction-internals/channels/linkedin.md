---
product: nanocoder
version: "1.27.0"
channel: linkedin
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.27.0 ships LLM-based context compaction as the new default `/compact` strategy. Instead of mechanically truncating older messages, the active model writes a structured markdown summary covering what was being worked on (Context), decisions made (Decisions), files modified, tools used, and open questions. Recent messages stay verbatim. The fidelity is higher than the old regex approach.

If the LLM call fails (network error, empty response, or summary larger than the original segment), Nanocoder falls back to mechanical truncation automatically. You can also force mechanical with `/compact --mechanical`.

There is also a fix worth calling out: auto-compact was ignoring per-provider `contextWindow` overrides before v1.27.0. The threshold was computed against the model's default context window even when the provider config set a smaller usable window. Now it uses the provider's resolved `contextWindow` as the base for the threshold calculation. This matters if you are running a large-context model but want compaction to fire at a lower absolute token count.

Find the full details and config options in the changelog.

https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.