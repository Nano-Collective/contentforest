---
product: nanocoder
version: "1.28.0"
channel: reddit
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
---

The headline of Nanocoder v1.28.0 mentions "tool surface consolidated from 33 to 19, automatic tune profile as default." That's two changes, not one, and the second is the more interesting one if you actually run small local models.

Here's the thing we wanted to land: a single `toolProfile: 'auto'` config value that does the right thing at runtime, with no per-model config drift, no manual tune tweaking every time you swap between your 7B local model and your cloud model, and no prompt-engineering ceremony to get a small model to behave.

What shipped:

- The tool surface genuinely is smaller. Tasks are one tool now (`write_tasks` with a replace-the-whole-list semantic - no ids for the model to juggle). File ops are one tool (`file_op` with an `operation` discriminator covering delete/move/copy/create_directory). Git is six typed tools, with branch/checkout/stash/push routing through `execute_bash`. ~6.3k lines went away.
- `auto` parses a size suffix from the active model id and picks `full`, `minimal`, or `nano`. `:1b`, `:1.5b`, `:2b`, `:3.8b`, `:135m` -> nano. `:7b`, `:8b`, `:12b` -> minimal. `:20b`, `:32b`, `:70b`, or anything with no size hint (cloud models) -> full.
- The resolved profile re-resolves on model switch. The status bar shows what `auto` picked (`tune: nano (auto)` on a wide terminal, just `tune: nano` when narrow). `/usage` reflects the live profile - the tool-definitions token count is whatever the resolved profile actually loaded.
- Development modes layer on top. `plan` + `nano` is the smallest viable planning setup. `plan` + `minimal` is the small-model planning sweet spot. `plan` + `full` keeps the typed read-only git and diagnostics. The mode filter runs after the tune filter, so the tighter of the two wins.
- The tune config resolves through 5 layers: hardcoded defaults, top-level `agents.config.json` `tune` block, per-provider `tune`, user preferences (`nanocoder-preferences.json`), and session override. Shallow merge, so a layer that sets `enabled: true` doesn't erase `toolProfile` set by a lower layer.

Why this matters for small-model workflows specifically:

The `nano` profile drops the `agent` tool entirely (subagent delegation adds prompt weight and recovery complexity that tiny models do not benefit from), enforces single-tool mode in the conversation loop, omits `AGENTS.md` from the prompt by default, and uses short-form prompt sections (the `-nano` variants of TASK APPROACH, FILE OPERATIONS, CONSTRAINTS). Result: ~150-250 token system prompt instead of the multi-thousand-token default, which is most of a 1-3B model's context window. Combined with the read-before-edit guards and tool-call loop detection that also landed in v1.28.0, unattended small models are a different shape of risk than they were before.

A few things we're honest about:

- The heuristic is name-based. A small local model whose tag does not carry a `:NxB` (or `NxM`) hint gets `full`. The safe failure mode (a too-large tool set is a perf issue, not a correctness issue), but worth knowing if you've renamed an Ollama tag.
- MCP tools are excluded from `minimal` and `nano` by construction. A user with custom MCP servers and a small local model sees none of them, not a curated subset. Curating per-profile MCP allowlists is reasonable future work but not in this release.
- A 70B model on a slow inference server still gets `full`. The heuristic doesn't know about throughput. If your cloud model is hitting context-budget or latency issues, the lever is `/tune`, not the auto heuristic.

The code is the code if you want to look: `source/tools/tool-profiles.ts` is the heuristic (~130 lines including the spec), `source/config/tune.ts` is the 5-layer merge, `source/utils/prompt-builder.ts` is where the profile actually changes the prompt, and `source/components/development-mode-indicator.tsx` is what renders `tune: nano (auto)` on the status bar.

Repo: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective - a community collective building AI tooling not for profit, but for the community.
