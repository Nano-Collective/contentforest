---
product: nanocoder
version: "1.27.0"
channel: reddit
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m2.7"
char_count: 0
---

v1.27.0 shipped a change to how `/compact` works that might not be obvious from the changelog headline.

The old default was mechanical truncation: regex heuristics that cut down long messages. v1.27.0 switches the default to LLM summarisation. The active model receives the older conversation segment as a transcript and writes a structured markdown summary covering five things: Context (what you were working on), Decisions (choices that should not be revisited), Files modified, Tools used, and Open questions or TODOs. The older messages get replaced with that one synthetic summary. The most recent messages stay at full fidelity so the conversation always has a readable tail.

The round-trip cost is one extra API call per compaction event. In exchange you get higher fidelity. If anything goes wrong (network error, empty response, or the summary ending up longer than the messages it replaced), Nanocoder falls back to mechanical truncation automatically. You can also force mechanical manually with `/compact --mechanical`.

There was a related bug fix: before v1.27.0, auto-compact was computing its firing threshold against the model's default context window, ignoring any `contextWindow` override set on the provider config. If you configured a provider with a narrower usable window, auto-compact would fire late or not at all. v1.27.0 uses the resolved `contextWindow` as the base for the threshold calculation, so the threshold percentage now applies to your actual working window rather than the model's theoretical maximum.

You can set `contextWindow` per-provider in `agents.config.json`, or per-model with `contextWindows[model]`. Auto-compact respects both.

https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.