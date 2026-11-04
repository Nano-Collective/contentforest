---
product: nanocoder
version: "1.32.0"
channel: reddit
title: "Nanocoder v1.32.0 - ACP sessions, a CI gate, browser and voice"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 4840
---

We shipped Nanocoder v1.32.0. It's a big one, and most of it is in the editor-integration layer, so here's the shape of it.

**ACP got the bulk of the work.** If you drive Nanocoder from an ACP client (the VS Code sidebar, Zed, or your own), a lot changed:

- Your editor can send its own `mcpServers` on `session/new`, `session/load` and `session/resume`. They're connected for that session only, and their tools exist only there and in any subagent that session starts. Your own MCP config is never touched.
- Sessions now have their own provider and model. Switching model in one session doesn't move the others. A turn that's already running finishes on the model it started with.
- You can disable a built-in tool for one session with `_meta: {"nanocoder/disabledTools": ["browser"]}`. Handy when the editor ships its own browser and you don't want two of them.
- You can pin a session against retention, cancel a single subagent without killing the turn, and read a file's before-image from a checkpoint.
- Our extension methods now use the `_nanocoder/` prefix that ACP reserves for custom methods. The old bare names still work but log a deprecation notice. `initialize` now lists the exact method names, so a client can detect support instead of inferring it from a version number.

We also fixed a lot of things that were quietly wrong. `session/close` was advertised but never implemented, so calling it returned method-not-found. Each session now works in its own `cwd` rather than the directory the agent process was spawned in, which is what made editors open the wrong files. Switching mode mid-prompt now takes effect immediately instead of leaving the turn in the mode it started in. A failed tool call now reports as failed rather than completed.

**The Agentic CI/CD Gate is the other big piece.** `nanocoder verify --pr <n>` runs a headless, read-only PR review with a semgrep pass scoped to the changed files, and can post it as a comment. The per-project daemon can watch GitHub Actions, investigate a failure with a read-only subagent, and post the diagnosis to the PR.

At `auto-fix` or `full-commit` trust levels it can also fix the failure. Worth being clear about the boundaries there: the fix agent can edit and commit but has no shell tool, so a CI log can't steer it into running commands. It starts with no GitHub tokens, no `gh` login, no ssh-agent and no credential helpers, and it can't push. The daemon publishes its commits from an isolated clone to your own `origin`. Anything posted to GitHub goes through secret redaction first. And `verify` always uses our built-in reviewer agent, so a PR can't ship its own.

**Two things you can use immediately.** A built-in `browser` tool (navigate, click, type, screenshot) on one shared headless Chromium page, with screenshots reaching vision models as images. Localhost is allowed; private network and cloud metadata addresses are blocked, including public hostnames that resolve to them. And voice mode: `/voice` for push-to-talk on `Ctrl+G` or hands-free speech detection, with local Whisper and Piper by default and opt-in OpenAI cloud STT/TTS.

**Smaller things worth knowing about:**

- `nanocoder trust --status` and `nanocoder trust --grant <fingerprint>` let a client check and grant directory trust without starting the agent. The trust prompt now fingerprints plugins, hooks, formatters, LSP servers, MCP servers and skills, and comes back when they change.
- `nanocoder.autoCommit` commits each agent file edit separately, with a Conventional Commit message the model writes. Off by default. Only the edited file is committed, so your own staged work isn't swept in.
- `nanocoder.formatters` runs Prettier, Biome, gofmt and friends on files the agent writes, matching a glob.
- Failed `string_replace` and `diff_edit` searches now return recovery evidence: likely target ranges, exact current text, whitespace notes. Still exact-match-only, still no fuzzy writes.
- A long failing test run now reaches the model as a failure capsule instead of a head-and-tail cut that dropped the failure detail from the middle of the log.
- `?key=value` overrides on slash commands, so `/usage ?context-max=200k` works for one command only.
- `nanocoder storage` is a read-only inspector for saved sessions and artifacts, with `--format json` for scripts.
- `nanocoder worktree <PR-number>` opens a PR in a sibling worktree without touching your checkout.

There's also a new agent evaluation harness under `benchmarks/agent/`. It measures pass/fail, steps, tokens and cost per task, and it's deliberately outside `test:all` because it needs real model calls. The fixtures ship with distractor files so a run working from degraded context fails an assertion rather than just finishing cheaper.

Install and changelog: https://github.com/Nano-Collective/nanocoder
