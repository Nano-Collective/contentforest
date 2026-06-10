---
product: nanocoder
version: "1.27.0"
channel: linkedin
generated_at: "2026-05-26T22:38:17.346Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-06-02T15:27:53.978Z"
---

Nanocoder v1.27.0 is out. The headline: Skills, a unified extension surface that brings custom commands, subagents, and tools under one model. Also new in this release:

**Skills (bundle form).** Drop a directory under `.nanocoder/skills/<name>/` with a `skill.yaml` manifest. The bundle's subagent automatically gets its sibling tools, scoped tools stay hidden from the global list, and commands auto-namespace. Everything fans out into the existing registries so your existing tooling keeps working.

**A background daemon.** Skill members can now subscribe to `file.changed` and `schedule.cron` events. Run `nanocoder daemon start` to opt in. It ships with launchd (macOS) and systemd user unit installers. Triggered runs execute in headless mode (no prompts), with per-subscription `confirm: true` to route into plan mode instead.

**The legacy scheduler is gone.** The old `source/schedule/` module, `.nanocoder/schedules.json`, and the scheduler mode are all removed. Schedules are now `schedule.cron` subscriptions on a skill member.

**Custom Tools.** A new extension type that sits between custom commands (prompt injection only) and MCP servers (full external process). Define a `.md` in `.nanocoder/tools/` with YAML parameter declarations and a shell command body using template placeholders. All substitutions are shell-quoted. Includes approval and read_only flags that compose with mode policy.

**LLM-based context compaction.** The default `/compact` strategy now uses the active model to write a structured summary of the compressible conversation segment, replacing the older messages with one synthetic note. Falls back to mechanical compression on failure.

**Config lint at startup.** Surfaces common misconfigurations as warnings before they cause silent failures.

**OpenRouter request configuration.** A new `openrouter` block on the provider config forwards routing rules, reasoning effort, plugins, and other OpenRouter-specific fields on every request.

**Two OOM fixes.** One on streaming long responses (was calling a full-message operation on every ~150 ms flush), one on the global performance buffer accumulating entries across long subagent sessions.

Plus: reworked OpenRouter model picker, unified Session Service, copyable code blocks without ASCII artifacts, and a new Nanocoder Battlemap comparing against Claude Code, Codex CLI, Gemini CLI, Aider, and others across twelve axes.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

Explore the full release at https://github.com/Nano-Collective/nanocoder