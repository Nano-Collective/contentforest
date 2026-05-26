---
product: nanocoder
version: "1.27.0"
channel: reddit
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m2.7"
char_count: 0
---

Nanocoder v1.27.0 is out. We shipped what is probably the most consequential extension story the project has had. Here is what changed and why.

## Skills: one primitive instead of three

Nanocoder has had custom commands, subagents, and tools as separate things with separate directories and separate loaders. v1.27.0 introduces Skills as the unified surface. The single-file form (a `.md` in `.nanocoder/commands|agents|tools/`) is backwards-compatible with how things already work. The new part is the bundle form: a directory under `.nanocoder/skills/<name>/` with a `skill.yaml` manifest. Everything inside a bundle ships and versions together. A bundle's subagent gets its sibling tools automatically, scoped tools stay hidden from the global list, and bundle commands auto-namespace (so `commands/status.md` inside bundle `git` invokes as `/git:status`). Bundled members fan out into the existing registries, so downstream consumers keep using their familiar APIs.

## A daemon for event-triggered runs

We removed the old scheduler module and replaced it with something more general. Skill members can now declare `subscribe:` blocks that wake them on `file.changed` and `schedule.cron` events. The daemon (`nanocoder daemon start`) runs as a long-lived background process with a lockfile, Unix-socket IPC, and installers for launchd (macOS) and systemd user units (Linux). The interactive TUI never starts event sources - you opt in by starting the daemon.

Triggered runs execute in a new internal headless mode (no `ask_user`, no foreground confirmations). Per-subscription `confirm: true` routes into plan mode instead. The daemon backpressure-caps per-subscription concurrency and debounces `file.changed` by 500 ms so a fast editor save loop does not pile up a queue of runs.

## Custom Tools

This is a new extension type that sits between custom commands (prompt injection only) and full MCP servers (external process, full protocol). Drop a `.md` into `.nanocoder/tools/` (project) or `~/.config/nanocoder/tools/` (personal), declare parameters in YAML frontmatter with JSON Schema-style types, write a shell command body using template placeholders, and the model can call it directly. All substitutions are shell-quoted to prevent injection.

```markdown
---
name: git_review
description: "Collect changed files for review"
parameters:
  - name: since
    type: string
    required: true
approval: never
read_only: true
---
git diff --name-only &#123;&#123;since&#125;&#125;..HEAD
```

The `approval` and `read_only` flags compose with mode policy: plan mode requires both off, scheduler/headless requires `approval=never`. `/tools create <name>` scaffolds a template. Project tools shadow personal ones by name, and they register into the same `ToolManager` registry as built-ins and MCP tools.

## LLM-based context compaction

The default `/compact` strategy is now LLM-based. The active model writes a structured summary (Context / Decisions / Files modified / Tools used / Open questions) using a dedicated summariser prompt, replacing the older messages with one synthetic note. Recent messages are kept verbatim. Falls back to mechanical compression on failure (network error, empty response, or summary larger than the original segment).

## Config lint at startup

We added startup validation that surfaces common misconfigurations as warnings before they cause silent failures: an `openrouter` block on a non-OpenRouter provider, unknown fields, type mismatches. Includes a full test suite.

## Two OOM fixes

One fix was for streaming long responses. `StreamingMessage` was calling `wrapWithTrimmedContinuations()` on the entire growing assistant message on every ~150 ms flush. A ~37k-token response would overwhelm GC and crash the 4 GB Node heap. The fix slices to a bounded tail before wrapping, so per-render work is constant.

The other fix was for the global `performance` buffer. React 19's `react-reconciler` (dev build) and Node's built-in fetch both write to it, and Nanocoder was never clearing it. Over long subagent-heavy sessions it accumulated millions of entries until V8 thrashed in mark-compact GC. The fix installs an unref'd 30-second interval that clears marks and measures.

## Other changes

- **OpenRouter request configuration.** A new `openrouter` block on the provider config forwards routing rules, reasoning effort, plugins, and other OpenRouter-specific fields on every request.
- **OpenRouter model selection.** Replaced the old flat list with a paginated, searchable picker (12 items visible, page navigation, select-all, running counter).
- **Unified Session Service.** Consolidated the ad-hoc keying strategies scattered across commands and handlers. Touched 50 files.
- **Battlemap.** A new competitive comparison doc covering Claude Code, Codex CLI, Gemini CLI, Aider, OpenCode, Crush, and Pi across twelve axes.
- **Copyable code blocks.** Reworked the markdown parser so fenced code blocks render as plain selectable text without surrounding ASCII box borders that used to get copied into the clipboard.
- **Nix packaging.** Updated for pnpm 11. Drops the version-override scaffolding and post-install hacks. Re-enables the `update-nix.yml` workflow.

Full changelog at https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.