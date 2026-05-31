---
product: nanocoder
version: "1.27.0"
channel: github-discussion
title: "Nanocoder v1.27.0 - Skills, a daemon, and custom tools"
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.27.0 is out. This release is the biggest extension surface the project has shipped: a unified extension primitive called Skills, a per-project background daemon for event-triggered runs, and a markdown-defined custom tools layer. Also: two OOM fixes, a startup config lint, and a reworked OpenRouter model picker.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## Skills: a unified extension primitive

Nanocoder has had custom commands, subagents, and tools as separate extension types. v1.27.0 replaces that with **Skills**: a single surface that brings all three under one ergonomic model.

A skill member lives in `.nanocoder/commands|agents|tools/` as a `.md` file - fully backwards-compatible with how those directories already work. The new behaviour is the **bundle** form: a directory under `.nanocoder/skills/<name>/` with a `skill.yaml` manifest and optional `commands/`, `agents/`, `tools/` subdirectories. Bundles ship and version together as a unit. A bundle's subagent automatically gets its sibling tools, scoped tools are hidden from the global tool list, and bundle commands auto-namespace (`commands/status.md` in bundle `git` invokes as `/git:status`).

New `/skills` slash command lists everything loaded. Bundled members fan out into the existing `CustomCommandLoader`, `SubagentLoader`, and `ToolManager.registry` - downstream consumers keep using their familiar registries.

Closes #515.

## A per-project daemon for event-triggered skill runs

Skill members can now declare `subscribe:` blocks in their frontmatter (or a bundle manifest) that wake them on `file.changed` and `schedule.cron` events. The daemon handles dispatch.

Start it with `nanocoder daemon start` (stop, status, and logs are also available). It runs as a long-lived background process with a lockfile, Unix-socket IPC, and ready-to-use installers for launchd (macOS) and systemd user units (Linux). The interactive TUI never starts event sources - file watching and cron only run when you opt in via the daemon.

Triggered runs execute in a new internal **headless** mode (no `ask_user`, no foreground confirmations). Per-subscription `confirm: true` opts into `plan` mode instead. The daemon backpressure-caps per-subscription concurrency and trailing-debounces `file.changed` by 500 ms so chatty save loops do not pile up.

## The legacy scheduler is gone

The old `source/schedule/` module (runner, storage, index, types) has been removed. Schedules are now expressed as `schedule.cron` subscriptions on a skill member. The old `useSchedulerMode` hook, `scheduler-view` component, and `.nanocoder/schedules.json` / `.nanocoder/schedules/*.md` storage layout are gone. The `/schedule` command has been trimmed and refocused.

Closes #524.

## Custom Tools: markdown-defined, model-callable tools

Custom Tools sit between custom commands (prompt injection only) and full MCP servers (external process, full protocol). Drop a `.md` into `.nanocoder/tools/` (project) or `~/.config/nanocoder/tools/` (personal), declare parameters in YAML frontmatter with JSON Schema-style types, and write a shell command body using template placeholders. All substitutions are shell-quoted to prevent injection.

Here is the full shape of a Custom Tool definition:

```markdown
---
name: git_review
description: "Run git diff and collect changed files for review"
parameters:
  - name: since
    type: string
    required: true
    description: "Show changes more recent than this ref"
approval: never
read_only: true
---
git diff --name-only &#123;&#123;since&#125;&#125;..HEAD
```

Includes `approval` (`always`/`never`) and `read_only` flags that participate in mode policy: plan mode requires `approval=never && read_only=true`, scheduler/headless requires `approval=never`. New `/tools create <name>` scaffolds a template and asks the model to help fill it in. Project tools shadow personal ones by name, and they register into the same `ToolManager` registry as built-ins and MCP tools.

Closes #520.

## LLM-based context compaction

The default `/compact` strategy is now LLM-based. The active model writes a structured markdown summary of the compressible segment (Context / Decisions / Files modified / Tools used / Open questions) using a dedicated summariser prompt, replacing the older messages with one synthetic summary. Recent messages are kept verbatim. Higher fidelity than mechanical truncation at the cost of one extra round-trip.

New `strategy` field in `autoCompact` config (`llm` default, `mechanical` legacy), new CLI flags (`--llm`, `--mechanical`, `--strategy <name>`), and automatic fallback to mechanical compression on LLM failure (network error, empty response, summary larger than original).

## OpenRouter request configuration

A new `openrouter` block on the provider config forwards OpenRouter-specific request body fields on every request: provider routing rules, reasoning, plugins, models fallback list, `service_tier`, `route`, `user`, and so on. Always-on transport and routing concerns, not gated by `/tune`. Provider is detected by name (case-insensitive). `tune.modelParameters.reasoningEffort` populates `openrouter.reasoning.effort` when unset; explicit values on the provider config always win.

Closes #519.

## Config lint at startup

Startup now surfaces common misconfigurations as warnings before they cause silent failures: an `openrouter` block on a provider that is not OpenRouter, unknown fields, type mismatches. Includes a full test suite.

Closes #523.

## OpenRouter model selection reworked

The provider wizard's model selection list has been replaced with a paginated, searchable `ModelSelectionList` (12 visible items, page navigation, multi-select with running counter, select-all, error state). Browsing OpenRouter's hundreds of models is now usable from the wizard.

Closes #516.

## Unified Session Service

A new Session Service consolidates the various ad-hoc keying strategies scattered across commands, handlers, and tool result display. Touched 50 files, removing duplicated key-derivation logic and shrinking `useAppState` by ~38 lines.

Closes #229.

## Nanocoder Battlemap

A new long-form competitive comparison doc covers Nanocoder against Claude Code, OpenAI Codex CLI, Gemini CLI, Aider, OpenCode, Crush, and Pi across twelve axes: license, pricing, local-model support, MCP, extensibility, tool-calling, subagents, surface, plain mode, stars, contributors, and telemetry. Honest where Nanocoder leads, honest where it does not.

Closes #423.

## Fixes

- **Streaming OOM on long responses.** `StreamingMessage` was calling `wrapWithTrimmedContinuations()` on the entire growing assistant message on every ~150 ms flush. A ~37k-token response would overwhelm the GC and crash the 4 GB Node heap. Now slices to a bounded tail before wrapping so per-render work is constant. Thanks to @abhishekDeshmukh74. Closes #526.

- **Performance entry buffer OOM in long sessions.** React 19's `react-reconciler` (dev build) and Node's built-in fetch (undici) both write to the global `performance` buffer, which nanocoder was never draining. Over long subagent-heavy sessions the buffer accumulated millions of entries until V8 thrashed in mark-compact GC. Fix installs an unref'd 30s interval that clears marks and measures in the Ink render path. Thanks to @ragini-pandey. Closes #521.

- Auto-compact now respects the per-provider `contextWindow` override instead of computing the threshold against the model's default context window. Closes #525.

- Errors from AI SDK providers now surface meaningful messages (status codes, body excerpts, nested fields) instead of `[object Object]`.

- Removed dead MCP server discovery hosts from the wizard templates (`remote.mcpservers.org` etc.). Companion guard in `mcp-client` prevents the wizard from surfacing entries it cannot reach.

- Markdown parser regressions fixed: indented fenced code blocks, fenced blocks inside blockquotes, and indented list continuations all extract correctly now. Indented-code extraction removed from the shared parser - only fenced blocks split out for copyable rendering.

- Code blocks are now copyable without surrounding ASCII box borders that previously got copied into the clipboard. Thanks to @aravindinduri.

- System prompt tightened to reduce over-eager task list creation on small jobs and to avoid markdown tables in model output (they render poorly in the terminal).

- Nix packaging updated for pnpm 11 via `pkgs.pnpm_11`. Drops version-override scaffolding and postInstall hacks. Re-enables the `update-nix.yml` workflow. Closes #511.

Full changelog at [https://github.com/Nano-Collective/nanocoder/blob/main/CHANGELOG.md](https://github.com/Nano-Collective/nanocoder).