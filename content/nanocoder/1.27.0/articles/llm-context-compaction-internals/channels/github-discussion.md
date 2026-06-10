---
product: nanocoder
version: "1.27.0"
channel: github-discussion
title: "LLM-based compaction and its fallback chain"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
---

The `/compact` command has a new default strategy in v1.27.0. Rather than the older mechanical approach that truncated messages with regex heuristics, Nanocoder now calls the active model to produce a structured markdown summary of the older conversation segment. This article walks through how that works end-to-end, what the fallback chain looks like, and why the per-provider `contextWindow` override factors into the firing threshold.

## How the LLM summariser works

When you call `/compact` (or when auto-compact triggers), Nanocoder serialises the compressible portion of the conversation as a transcript and sends it to the active model with a dedicated summariser prompt. The model is instructed to produce a structured markdown summary covering five sections:

- **Context** - what the user is working on and the current state of the task.
- **Decisions** - choices made by the user or agent that should not be revisited.
- **Files modified** - each touched file and what changed.
- **Tools used** - notable tool invocations and their outcomes.
- **Open questions** - anything unresolved or deferred.

The output replaces the older messages with one synthetic summary message. The most recent messages (configurable, but several by default) are kept verbatim so the conversation always has a readable tail. The summariser call runs synchronously and locks input - you cannot send a new message mid-compaction.

This is a one-shot round-trip. The fidelity is higher than mechanical truncation because the model preserves the intent of the conversation rather than applying heuristics blindly. The cost is one additional API call per compaction event.

## The fallback chain

The LLM path is not the only option. Mechanical truncation remains available and is used automatically in three situations:

1. **Network error** - the summariser call fails to reach the provider.
2. **Empty response** - the model returns nothing or a response Nanocoder cannot parse.
3. **Summary larger than original** - the synthetic summary ends up longer than the messages it replaced, which would defeat the purpose.

In each case, Nanocoder falls back to the mechanical strategy for that invocation without prompting. You can also force mechanical mode manually:

```bash
/compact --mechanical
/compact --mechanical --aggressive  # maximum token savings
/compact --mechanical --conservative  # preserves more detail
```

Or switch the session-default strategy:

```bash
/compact --strategy mechanical
```

The `strategy` field in `autoCompact` config accepts `llm` (default) or `mechanical`:

```json
{
  "nanocoder": {
    "autoCompact": {
      "strategy": "llm"
    }
  }
}
```

Auto-compact uses the same fallback chain. When it fires, it calls the active model with the summariser prompt; if that fails for any of the three reasons above, mechanical truncation runs instead.

## Per-provider contextWindow and the firing threshold

Auto-compact triggers when the conversation reaches a configurable percentage of the model's context limit. The threshold is expressed as a percentage (default 60%) of the usable context window.

This is where the per-provider `contextWindow` override matters. In v1.26.0, Nanocoder added `contextWindow` and `contextWindows[model]` on the provider config, allowing you to specify a narrower usable window than the model's default. For example, if a provider has a 200k token context but you want auto-compact to fire at 80k tokens, you set:

```json
{
  "nanocoder": {
    "providers": [
      {
        "name": "my-provider",
        "contextWindow": 80000
      }
    ]
  }
}
```

Before v1.27.0, auto-compact ignored this override. The threshold was computed against the model's default context window even when the provider config narrowed it. This caused compaction to fire late (or not at all) on providers configured with a smaller usable window.

v1.27.0 fixes this. Auto-compact now uses the active provider's `contextWindow` (or the resolved `contextWindows[model]` override) as the base for the threshold calculation. If a provider is configured with `contextWindow: 80000`, auto-compact fires when the conversation hits 48k tokens (60% of 80k), not 60% of the model's default 200k window.

This matters most when:
- You are using a model with a very large context window but operating within a narrower budget.
- You are using a provider that imposes rate limits or cost-per-token pricing that makes large contexts expensive.
- You have auto-compact set to a lower threshold (e.g. 50%) and want it to fire relative to your actual working window, not the model's theoretical maximum.

## Configuring auto-compact

```json
{
  "nanocoder": {
    "autoCompact": {
      "enabled": true,
      "threshold": 60,
      "strategy": "llm",
      "mode": "conservative",
      "notifyUser": true
    }
  }
}
```

- `threshold` - percentage of the resolved context window at which compaction fires (50-95).
- `strategy` - `llm` (default) or `mechanical`.
- `mode` - applies only to mechanical: `default`, `conservative`, or `aggressive`.
- `notifyUser` - show a notification when auto-compact runs.

Session overrides work without modifying the config:

```bash
/compact --auto-on --threshold 75 --strategy llm
```

## What is preserved

Both strategies preserve:
- Recent messages (kept at full detail).
- Tool calls and their structure.
- File modifications and tool results.

Neither strategy removes system messages, recent context, or the structure of tool invocations. The compression targets the older, larger portion of the conversation.

## When to use which strategy

LLM summarisation is the default and is the right choice in most cases. Higher fidelity at the cost of one round-trip. Falls back to mechanical automatically if anything goes wrong.

Switch to mechanical when:
- The model is local and does not support tool-grade summarisation quality.
- You want zero additional API cost per compaction.
- The network path to the provider is unreliable.

In either case, auto-compact handles the firing decision and applies the configured fallback automatically.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

---

Full changelog: https://github.com/Nano-Collective/nanocoder