---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-19T19:51:41.293Z"
model: "minimax-m2.7"
char_count: 3886
wont_use_at: "2026-05-20T14:06:41.615Z"
---

Mario Zechner built pi as a solo MIT-licensed project. He has been transparent about the acquisition by Earendil, backed by Accel and Balderton. That transparency is genuine and worth acknowledging.

But transparency about a structure does not change what the structure requires.

The MIT core will remain. The architecture of what happens next will not be the same. That is not a criticism of Zechner. It is an observation about how ownership shapes what tools become.

This is the question I keep coming back to when I evaluate AI coding tools: not what does it do, but who does it answer to?

## What Nanocoder is, structurally

Nanocoder is built by the Nano Collective, a not-for-profit community group. No VC, no holding company, no exit pressure. The roadmap is public and contributor-led.

This is not a marketing claim. It is the reason the architecture looks the way it does.

Because if the roadmap is contributor-led and the governance is open, then the features that ship are the features the community needs. Not the features that justify a pricing tier.

This shapes everything from the provider choices to the safety scaffolding.

## How this plays out in practice

The local-first approach is the clearest example. Nanocoder treats Ollama as a first-class provider, not a checkbox next to the OpenAI and Anthropic integrations. That is not an accident. When your user base is the people running local models, local models get the same care as hosted ones. The architecture reflects the constituency. A community that uses local models will not tolerate local models being second-class citizens.

The TUI is another. Built with React and Ink.js, it produces a proper interactive interface: tool confirmations, formatted diffs, file explorers, status indicators, notifications. This is not UI polish for its own sake. It reflects a design philosophy that a local-first coding agent should be useful the moment you install it. You should not need to spend a weekend assembling the environment before you start working.

Four modes are built in and toggled with Shift+Tab: normal, auto-accept, yolo, and plan. None of these require a plugin. None of them are locked behind a paid tier. Plan mode, specifically, is a top-level mode with its own UI, not an extension you install. That matters because the people who most need a planning mode are the people least likely to know they need to build one.

Safety scaffolding is similarly default-on. Directory trust checks on first run in a new folder. A checkpoint manager and file snapshots so edits are recoverable. Session autosave and resume so a crashed terminal does not cost you a conversation. These are not features you add. They are the floor. They are there because a community that has to live with the consequences of bad tooling built them in.

MCP servers load at startup from config. Subagents are a built-in primitive under `source/subagents/`. Scheduled agents run on cron via a dedicated scheduler mode with interactive tools auto-disabled for unattended runs. These are not things each user has to build. They are what it means to have shipped them.

There is also a plain shell mode for CI and non-TTY environments, a VS Code extension from the same codebase, and LSP integration for language-aware edits. But the point is not the list of features. The point is the philosophy: a local-first coding agent should be useful when you install it, not after you have spent time configuring it.

## The principle behind the decisions

Community governance is not a constraint on what Nanocoder can build. It is what determines whether the tool will still exist, unchanged in its values, after the next funding cycle, the next pivot, and the next acquisition rumour.

The worst case for a community collective is a fork. The worst case for a VC-backed project is a quiet acquisition and a shutdown notice. These are not symmetrical outcomes.

This does not mean community projects are always better. A VC-backed team can ship faster, has resources, can hire. But those advantages are contingent on investor appetite, and investor appetite changes. The tool that exists today may not be the same tool in three years. That is not a character flaw in the founders. It is how capital structures work.

The tools that sit between developers and their code should be tools that answer to developers. That is the architectural argument. Everything else follows from it.

Read more at https://nanocollective.org