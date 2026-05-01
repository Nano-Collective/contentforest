---
product: nanocoder
version: "1.25.0"
channel: github-discussion
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

# The three bugs that broke alwaysAllow for bash

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

---

v1.25.0 closes a bug that had been open for some time: `alwaysAllow` in `agents.config.json` was not being respected for the `execute_bash` tool. Three separate bugs combined to produce the failure, each subtle enough that they passed review individually. This is a close look at all three, for the operators affected and anyone debugging similar patterns.

## Background: how alwaysAllow works

Nanocoder's `alwaysAllow` list in `agents.config.json` lets you specify tools that skip the approval prompt. When a tool is in the list, it executes without asking. This is documented behaviour — add `execute_bash` to `alwaysAllow` and bash commands run automatically.

The feature had been working for read/write file tools. It was documented for `execute_bash`. It was not working.

## Bug 1: top-level alwaysAllow was never loaded

The config loading code read `alwaysAllow` from `nanocoderTools.alwaysAllow` (the MCP-server-specific subfield) but not from the top-level `alwaysAllow` field in the config object. The top-level field is where users put it when configuring the main Nanocoder session.

```json
// agents.config.json
{
  "nanocoderTools": {
    // ...
  },
  "alwaysAllow": ["execute_bash", "read_file"]
}
```

The code only checked `nanocoderTools.alwaysAllow`, so top-level `alwaysAllow` was ignored entirely.

## Bug 2: isNanocoderToolAlwaysAllowed only checked one field

The function `isNanocoderToolAlwaysAllowed` — responsible for determining whether a tool needs approval — only consulted `nanocoderTools.alwaysAllow`, not the top-level list. Even if the top-level list had been loaded, this function would not have found it.

The fix was straightforward: both fields needed to be checked.

## Bug 3: nonInteractiveAlwaysAllow clobbered the permission state

The third bug was in the non-interactive mode path. When running in non-interactive mode, the code set `needsApproval: false` on AI SDK tools (file tools, bash, etc.) for the auto-execute flow. This override ran after the config loading and permission check, so it reset the permission state regardless of what `alwaysAllow` said.

The specific failure: `nonInteractiveAlwaysAllow` set `needsApproval` on AI SDK tools, but the conversation loop evaluated tool approval from the original registry entries — before the override had propagated.

The result was a tool that appeared approved in the non-interactive path but still prompted in interactive mode, depending on which evaluation path was hit.

## How they were found

The combination was not obvious from any single symptom. The first two bugs masked each other — if either had existed alone, the third bug would still have been the dominant failure. The third bug was the one that made the issue reproducible: it manifested differently in interactive vs non-interactive mode, which eventually led to tracing the execution path through both code paths.

Debug logging was added to 15 previously silent catch blocks in git utilities in the same release, which was unrelated but improved confidence in the overall tool execution path.

## The fix

Each bug needed a distinct fix:

1. Config loading now reads the top-level `alwaysAllow` field.
2. `isNanocoderToolAlwaysAllowed` now checks both the nanocoderTools subfield and the top-level list.
3. `nonInteractiveAlwaysAllow` no longer resets the permission state for tools that `alwaysAllow` has already approved.

The three fixes are in separate locations in the codebase, which is why they escaped individual review. Closes #431.

## What this means for operators

If you had `alwaysAllow` configured and were still seeing bash confirmation prompts in interactive mode, this release should resolve it. No config changes needed — if your `alwaysAllow` list had `execute_bash` in it and you were still prompted, the bug is now fixed.

If you were relying on the non-interactive mode path specifically, the fix should also improve that behaviour. The non-interactive path was also affected by bug 3 in a way that produced intermittent failures depending on tool ordering.

---

Questions on [GitHub](https://github.com/Nano-Collective/nanocoder) or [Discord](https://discord.gg/ktPDV6rekE).
