---
product: nanocoder
version: "1.28.0"
channel: github-discussion
title: "Tune, auto-detected - how the new tool profiles pick themselves"
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-07-20T14:13:08.838Z"
---

The headline of v1.28.0 mentions that the tool surface was consolidated from 33 to 19 and that an automatic tune profile is now the default. Both halves of that sentence deserve a closer look, because the interesting design work is not in the count, it is in how a single config flag (`toolProfile: 'auto'`) decides at runtime which tools a given model sees, which prompt sections it gets, and how the answer changes the moment you switch models. This post walks through the mechanics: the consolidation itself, the parameter-count heuristic, the 5-layer config hierarchy that resolves `tune`, the interaction with development modes, and what local-model workflows gain from a profile that re-resolves live on model switch.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## The shortest possible description

Three concrete tool profiles exist (`full`, `minimal`, `nano`) plus one meta-profile (`auto`) that picks between them from the active model id. The default is `auto`, so most users never set anything. The work in v1.28.0 was the consolidation that let the default be sensible, plus the live re-resolution that makes the default honest.

```ts
// source/tools/tool-profiles.ts
type ConcreteProfile = Exclude<ToolProfile, 'auto'>;

const TOOL_PROFILES: Record<ConcreteProfile, string[]> = {
  full: [],                                                 // no filtering
  minimal: ['read_file', 'write_file', 'string_replace',
            'execute_bash', 'find_files',
            'search_file_contents', 'list_directory', 'agent'],
  nano:   ['read_file', 'string_replace', 'write_file',
            'execute_bash', 'search_file_contents'],
};
```

A few details worth knowing about that shape:

- `full` is the empty array. Empty means "no filtering applied" - all registered tools, including MCP servers, remain available. The convention lets `minimal` and `nano` be hand-maintained allowlists while `full` stays correct as new tools land.
- MCP tools are excluded from `minimal` and `nano` by construction: only built-in tool names appear in the allowlists. A user with custom MCP servers who switches to a small model and is surprised at the missing tool is being told, honestly, that the surface area has been trimmed.
- The drift guard test (`source/tools/tool-profiles.spec.ts`) iterates each profile and asserts that every named tool is registered with `ToolManager`. A renamed tool that leaves a dangling entry behind fails the test on the next CI run, rather than silently filtering nothing.
- `nano` drops the `agent` tool - subagent delegation is off the table for the smallest models. This is a deliberate scope cut: delegation adds prompt weight, error-recovery complexity, and a turn-multiplier that tiny local models do not benefit from.

## The consolidation: why 19

The 33-to-19 number is a result, not a target. Three buckets drove it:

- **Tasks** collapsed from four tools into a single `write_tasks`. The model no longer juggles task ids, completion flags, and per-task update calls; it just writes the current state of the list. That removed three tools and removed a class of bug where the model left stale ids behind.
- **File ops** merged `delete_file`, `move`, `copy`, and `create_directory` into one `file_op` with an `operation` discriminator. Four tools became one. The merger is shape-preserving for the common case and the move/copy/create variants keep their previous semantics under the same schema.
- **Git** shrank from eleven tools to six: `status`, `diff`, `log`, `add`, `commit`, `pr`. Rare operations - branch, checkout, stash, push, fetch, remote management - route through `execute_bash`. The git subagent workflow still uses the typed tools where it adds value; the model can always shell out when it needs the long tail.

Roughly 6.3k lines went away across this work, including dedup across config loaders, git exec, command dispatch, and the conversation-loop flush path. The consolidation is also what made `auto` defensible as a default: with a hand-curated allowlist for each profile, the heuristic at the top is small enough to be obviously right and the drift guard keeps it that way.

## The heuristic: how `auto` picks from the model id

The decision lives in `inferToolProfile`, and it is short on purpose:

```ts
// source/tools/tool-profiles.ts
function modelParamsBillions(model: string): number | null {
  const lower = model.toLowerCase();

  // Millions suffix (e.g. 135m) - always tiny.
  const millions = lower.match(/(\d+(?:\.\d+)?)\s*m\b(?![a-z])/g);
  if (millions && millions.length > 0) {
    return 0.5; // treat any sub-billion model as tiny
  }

  // Billions suffix - take the last match (model tags put the size last).
  const billions = [...lower.matchAll(/(\d+(?:\.\d+)?)\s*b\b(?![a-z])/g)];
  if (billions.length > 0) {
    const last = billions[billions.length - 1];
    return parseFloat(last[1]);
  }

  return null;
}

export function inferToolProfile(model?: string): ConcreteProfile {
  if (!model) return 'full';
  const params = modelParamsBillions(model);
  if (params === null) return 'full'; // cloud / unknown - assume capable
  if (params <= 4)  return 'nano';
  if (params <= 15) return 'minimal';
  return 'full';
}
```

A few decisions worth being explicit about:

- **Cloud models get `full` by default.** A model id with no size hint (`gpt-4o`, `claude-opus-4-8`, `o3-mini`) is treated as "the user is paying for capability, give it the surface area". The threshold for "I know this is small" is a size suffix in the id; the absence of that hint is the signal of capability. A small open-source model without a `:NxB` tag will be misclassified as `full`, which is the safer failure mode - a too-large tool set is a runtime perf issue, not a correctness issue.
- **The `<=4B` boundary is the nano threshold**, `<=15B` is minimal, anything larger is full. The spec suite locks these: `llama3.2:1b`, `deepseek-r1:1.5b`, `gemma2:2b`, `phi3:3.8b`, and `smollm:135m` all resolve to `nano`; `qwen2.5-coder:7b`, `llama3.1:8b`, `mistral-nemo:12b` to `minimal`; `gpt-oss:20b`, `qwen2.5-coder:32b`, `llama3.3:70b` to `full`.
- **The "last match wins" rule** handles tag-style ids where the size is at the end (`qwen2.5-coder:7b`) and base-model references where the size might be earlier in a longer string. Picking the last match is the same heuristic Ollama and LM Studio use when parsing tags; it is the least surprising choice.
- **`auto` propagates through every helper.** `isSingleToolProfile('auto', 'llama3.2:1b')` returns true. `isNanoProfile('auto', 'qwen2.5-coder:7b')` returns false. `getToolsForProfile('auto', 'qwen2.5-coder:7b')` returns the eight-tool minimal list. The auto meta-profile is resolved once per call, and the rest of the codebase never needs to know `auto` exists.

## What the resolved profile actually changes

`auto` and its resolved concrete profile feed four distinct code paths.

**1. The tool list.** `ToolManager.getAvailableToolNames` is the single authority for tool availability. It runs the tune profile first, then the mode exclusions, then the user-configured `disabledTools` list, in that order. When `toolProfile: 'auto'` resolves to `minimal` for a 7B model, the tool list the model sees is the eight-tool allowlist above; the conversation loop builds the prompt against that exact list.

```ts
// source/tools/tool-manager.ts (excerpt)
if (tuneConfig?.enabled) {
  const profile = resolveToolProfile(tuneConfig.toolProfile, model);
  if (profile !== 'full') {
    const profileTools = getToolsForProfile(profile);
    if (profileTools.length > 0) {
      names = profileTools;
    }
  }
}
```

**2. The system prompt.** `buildSystemPrompt` switches its sections based on the resolved profile. Under `nano`, the `CORE PRINCIPLES` section is dropped, the `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` sections use the `-nano` variants (each capped at a few lines), the verbose `SYSTEM INFORMATION` block becomes a single `## SYSTEM` line, and `AGENTS.md` is omitted by default. The full doc puts the result at roughly 150-250 tokens for `nano`, versus 500-700 for `minimal` and the full multi-thousand-token default.

**3. Single-tool enforcement.** Both `minimal` and `nano` enable single-tool mode in the conversation loop:

```ts
// source/hooks/chat-handler/conversation/conversation-loop.tsx
const enforceSingleTool =
  tune?.enabled && isSingleToolProfile(tune.toolProfile, currentModel);
if (enforceSingleTool && allToolCalls.length > 1) {
  allToolCalls = allToolCalls.slice(0, 1);
}
```

Small local models struggle to choose one tool from a list and produce a coherent response. Truncating to the first call and forcing a wait-for-result cycle matches how the model wants to work and turns "model tried to do three things and forgot the schema on the second" into a recoverable failure mode.

**4. The status bar and `/usage`.** The development-mode indicator resolves the profile against the live model and shows `tune: nano (auto)` (or just `tune: nano` on narrow terminals). `/usage` rebuilds from the live tune, mode, and model - the `toolDefinitions` count reflects what is actually loaded, and the system-prompt token count reflects the nano-variant sections. The spec explicitly guards this with `t.true(nanoBreakdown.toolDefinitions < fullBreakdown.toolDefinitions)` so a regression that lets `/usage` count the full registry under `nano` is caught on the next run.

## The 5-layer config hierarchy

`resolveTune` in `source/config/tune.ts` is what makes the per-provider example from the docs work:

```ts
export function resolveTune(
  appConfig?: AppConfig,
  providerConfig?: AIProviderConfig,
  preferences?: UserPreferences,
  sessionOverride?: TuneConfig,
): TuneConfig {
  let resolved: TuneConfig = {...TUNE_DEFAULTS};

  if (appConfig?.tune)              resolved = {...resolved, ...appConfig.tune};
  if (providerConfig?.tune)         resolved = {...resolved, ...providerConfig.tune};
  if (preferences?.tune)            resolved = {...resolved, ...preferences.tune};
  if (sessionOverride)              resolved = {...resolved, ...sessionOverride};

  return resolved;
}
```

Five layers, highest priority wins:

1. **Hardcoded defaults** - `enabled: false`, `toolProfile: 'full'`, `aggressiveCompact: false`. The "do nothing" baseline.
2. **Top-level config** - `tune` block in `agents.config.json`. Applies to every provider.
3. **Per-provider config** - `tune` inside a provider entry. The docs' Ollama example pins `toolProfile: 'minimal'` and `aggressiveCompact: true` to that provider; switching to a different provider falls back to layer 2.
4. **Preferences** - the user's `/tune` choices, persisted to `nanocoder-preferences.json`. Survives session restarts.
5. **Session override** - in-memory changes made during the current session. Highest priority.

The useful consequence is that an operator can ship a project-level `agents.config.json` with `tune.toolProfile: 'auto'` as a global default, layer a per-provider `toolProfile: 'minimal'` on top of the Ollama provider that everyone on the team uses for the 7B model, and let individual users still flip into `nano` from the `/tune` UI without touching config. The merge is shallow (`...resolved, ...layer`), so a layer that sets `enabled: true` does not erase `toolProfile` set by a lower layer - only the keys present on the higher layer win.

## Interaction with development modes

The tune profile is not the only thing filtering the tool list. `MODE_EXCLUDED_TOOLS` removes mode-incompatible tools on top of the profile filter, and the tune `enabled` flag is independent of the mode. In practice, three combinations matter:

- **`plan` + `minimal`** is the small-model planning setup. The four exploration tools (`read_file`, `find_files`, `search_file_contents`, `list_directory`) survive the mode exclusions, the slim prompt keeps the model on task, and the typed plan output is the canonical small-model workflow. The companion local-model safety additions in v1.28.0 (read-before-edit guards and tool-call loop detection) cover the failure modes that come up most often when a small model is left running on its own.
- **`plan` + `nano`** trims further. The exploration surface is `read_file` and `search_file_contents` only, the plan-mode prompt uses the nano variant, and `find_files` is gone. Useful on the smallest hardware, where even a glob-style file finder is too expensive to invoke.
- **`plan` + `full`** keeps the full plan surface, including the read-only git tools and the diagnostics. This is the mode for a capable model that needs a structured plan before doing anything destructive.

The mode filter runs after the tune filter in `getAvailableToolNames`, so a profile that excludes `find_files` and a mode that excludes `delete_file` together produce the intersection. The order is intentional: the profile says "this model cannot handle the full surface", the mode says "this session is read-only" - whichever is tighter wins.

A small but important fix shipped alongside this: the executor used to capture the development mode once at startup and silently ignore any later Shift+Tab switch. That is now resolved at every approval decision, so a subagent that starts in `normal` and gets promoted to `yolo` mid-run actually runs in `yolo`. The tune profile does not change with a mode switch (it follows the model), but the mode policy applied on top of the profile does, which is the interaction that mattered.

## Live re-resolution on model switch

The `currentModel` state is the only input the profile helpers need, and it is the same React state passed into every consumer that builds a tool list or a prompt. When a user changes model mid-session - via the model picker, a CLI flag, or a config reload - the next render of `buildSystemPrompt`, the next call to `getAvailableToolNames`, and the next render of the status-bar indicator all see the new model id and produce output against the new resolved profile. There is no explicit "rebuild" call: the profile is recomputed from the live model each time, which is what makes `tune: nano (auto)` switch to `tune: minimal (auto)` the instant you swap from `qwen2.5-coder:1.5b` to `qwen2.5-coder:7b`.

`warnIfHistoryWontFit` runs alongside the switch and surfaces a warning if the previous conversation is too large for the new model's context window. The conversation itself is kept - the model change is not a session reset - but the next turn rebuilds the tool list and the prompt against the new model, so a transition from a 70B cloud model to a 7B local model is a graceful trim rather than a hard cut.

For operators who want to pin a profile explicitly, the per-provider config layer is the place. The Ollama example in the docs is the canonical case: a team that uses Ollama for the 7B coding model and OpenRouter for the 70B model gets `minimal` automatically on Ollama and `full` automatically on OpenRouter, without touching the per-session state.

## What local-model workflows actually gain

In numbers, the gain is not subtle. A 7B model under `auto` resolved to `minimal` sees an eight-tool registry instead of a 19- (or 33-) tool one, and a system prompt in the 500-700 token range instead of the multi-thousand-token default. A 1-3B model under `auto` resolved to `nano` sees five tools, a 150-250 token prompt, single-tool enforcement on top, and `AGENTS.md` omitted. Both also skip the `agent` tool entirely, which removes a class of recovery bug that small models hit when subagent output drifts out of their context window.

In workflow terms:

- A small local model running unattended is materially safer than it was. The read-before-edit guards and tool-call loop detection that shipped alongside the consolidation land in the same code path the new profiles use, so a `nano` profile plus an unattended small model is a different shape of risk than the pre-v1.28.0 setup.
- Switching between a local 7B and a cloud model mid-session is a one-prompt operation, not a config edit. The status bar tells you what `auto` resolved to, so you can see the trim happen rather than guessing whether the smaller tool set is in effect.
- Operators can ship a project-level default that is right for the team's primary provider without forcing it on the one developer using a different model on their own machine. The 5-layer merge handles the override.

## What is still rough

A few honest limits:

- **Profile resolution is name-based, not metadata-based.** The heuristic parses a size suffix from the model id. A small local model whose tag does not carry a `:NxB` (or `NxM`) hint gets `full`. The safe failure mode, but worth knowing if you have a custom Ollama tag like `my-fine-tune` for a small base.
- **The MCP story under `minimal`/`nano` is "exclude", not "reduce".** A user with a dozen MCP servers and a small local model sees none of them, not a curated subset. Curating per-profile MCP allowlists is reasonable future work but is not in v1.28.0.
- **`auto` is silent on capability boundaries it cannot see.** A 70B model on a slow inference server will still get `full`; the profile does not account for throughput. If your cloud model is hitting context-budget or latency issues, the lever is still `/tune`, not the auto heuristic.
- **The drift guard catches renamed tools but not renamed provider names.** If you rename a custom tool, the test only checks the built-in profiles' allowlists; custom tools are loaded dynamically.

## Closing

The v1.28.0 tool consolidation was not really about the count. It was about making it cheap to ship hand-curated tool allowlists, which made it cheap to make `auto` the default, which made the five-line `modelParamsBillions` heuristic the thing the user actually sees. The 5-layer config hierarchy is what lets an operator tune the default without forcing it, the development-mode filter is what keeps the profile honest about read-only and approval policy, and the live re-resolution is what makes the whole thing feel like one runtime rather than five configs you have to remember to flip.

If you try `auto` on a small local model and it picks the wrong profile, or if you want a model size to map differently, the easiest place to push is `source/tools/tool-profiles.ts` - the heuristic is small and the spec is the spec. Open an issue on the [Nanocoder repo](https://github.com/Nano-Collective/nanocoder) if you hit something that the heuristic cannot read.
