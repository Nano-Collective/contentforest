---
kind: collective
slug: pi-versus-nanocoder
channel: github-discussion
title: "Nanocoder vs Pi: a comparison from the Nano Collective side"
generated_at: "2026-05-13T22:34:48.445Z"
model: "minimax-m2.7"
char_count: 3780
distributed_at: "2026-05-18T12:31:16.245Z"
---

[[Pi](https://pi.dev/)](https://pi.dev/) is a thoughtful, well-built terminal coding agent. We respect the engineering behind it. This is not a takedown, it is a "which one fits me?" guide written from our side of the fence.

The biggest difference between Nanocoder and Pi is not technical. It is **who owns the project, and who the project ultimately answers to.**

## Who builds these things, and who they answer to

Pi started life as a personal open-source project by Mario Zechner, the creator of libGDX. It is MIT-licensed and was built with real care. In April 2026, Pi moved to a new home: Earendil, a company backed by Accel, Balderton, and the founders of n8n. Zechner is now a shareholder and remains in charge of Pi's direction alongside Armin Ronacher and Colin at Earendil.

Earendil has been refreshingly transparent about all of this. They have published an [[RFC](https://rfc.earendil.com/0015/)](https://rfc.earendil.com/0015/) explaining that Pi's core will stay MIT, that they will use trademark rather than license tricks to protect commercial work, and that they intend to build some Fair Source and proprietary additions on top of the MIT core over time. That is more honesty than most companies offer at this stage, and we want to acknowledge it.

But it is still the structure that matters here. Earendil has investors, and investors eventually need a return. The team has said openly that commercial offerings are coming, they just do not know what they are yet. When a roadmap has to support a business model, "what users actually need" and "what we need to monetise" can stop being the same question, and when they diverge, the answer tends in one direction.

Nanocoder is built by the [[Nano Collective](https://nanocollective.org/)](https://nanocollective.org), a not-for-profit, community-driven collective. No VC, no holding company, no exit pressure, no cap table. The roadmap is decided in the open by the people actually using the tool. We fund development through donations and consulting work, not by eventually converting users into subscribers.

We genuinely believe that agentic coding tools, the things that increasingly sit between developers and their code, should not be owned by a handful of corporations. If that future matters to you, the project you pick today matters.

That is the headline. The rest of this post is the supporting detail.

## The short technical version

Pi is a minimal harness you extend. Nanocoder is a coding agent you run. Pi ships a deliberately tiny core, four tools and a short system prompt, and asks you to add the rest through TypeScript extensions, skills, prompt templates, and packages. Nanocoder ships those as first-class features, because we think a local-first coding agent should work the moment you install it, not after a weekend of plumbing.

Neither approach is wrong. They are aimed at different people, and they are accountable to different people.

## Where Pi has made its philosophy clear

Some of these are not "missing features," they are intentional refusals, and Zechner has written about them at length:

- **No MCP support**, deliberately. The argument is that MCP servers load large tool definitions into every session and create context overhead. Pi's answer is "use CLI tools with READMEs the agent reads on demand," or write an extension.
- **No built-in sub-agents**. The view is that sub-agents are black boxes with poor observability.
- **No built-in plan mode as a distinct UI**. Plans are markdown files you and the agent edit together.

These are coherent positions. If you agree with them, Pi is built for you. If you do not, Nanocoder probably is.

## Where Nanocoder leans in

### Local-first, by default

Nanocoder is built around one belief: your code, your model choice, your machine. We invest specifically in making small local models good at agentic coding, not just wiring up frontier APIs. Ollama is a first-class provider, not an afterthought.

### Rich Ink-based TUI

Nanocoder is a React + Ink.js application. You get tool confirmation prompts, formatted diffs, file explorers, status bars, wizards, and notifications out of the box. Pi has its own well-engineered TUI too (it is famously flicker-free and the session tree is genuinely nice), but the philosophy is different: Pi gives you primitives and expects you to build the workflow around them. Nanocoder ships the workflow.

### Built-in modes you can actually feel

Four modes are baked in and toggled with Shift+Tab:

- **normal** - confirm each tool
- **auto-accept** - auto-run safe tools, still prompt for bash and destructive git
- **yolo** - run everything, your call
- **plan** - show tool calls without executing

Plan mode is a top-level mode with its own UI, not a markdown convention.

### MCP, subagents, and scheduling out of the box

- **MCP servers** are loaded at startup from config, no extension required. If you want MCP in Pi today, you install a third-party adapter and configure it. In Nanocoder, you write a config file.
- **Subagents** are a built-in primitive for delegating runs, including built-in Explore and Reviewer agents.
- **Scheduled agents** run on cron via a dedicated scheduler mode, with interactive tools auto-disabled for unattended runs.

These are features we want every user to have, not features each user has to assemble.

### Safety scaffolding you do not have to wire up

- **Directory trust check** on first run in a new folder.
- **Checkpoint manager** and **file snapshots** so edits are recoverable.
- **Tool validators and formatters** that gate execution and render results consistently.
- **Session autosave and resume** so a crashed terminal does not cost you a conversation.

### Slash commands without writing code

Drop a markdown file into `.nanocoder/commands/` and it becomes a slash command. No TypeScript module, no build step, no package manifest. Power users can still write real commands in `source/commands/`, but the lowest rung of the ladder is "write a markdown file."

### Provider breadth with sane defaults

Built on Vercel AI SDK v6 with `@ai-sdk/openai-compatible`, plus dedicated `@ai-sdk/anthropic` and `@ai-sdk/google` providers. Any OpenAI-compatible endpoint works. We also ship:

- **Copilot and Codex device-flow login** built in, no shell-scripting needed.
- An **XML tool-call fallback path** for models that do not support native tool calling, so smaller local models stay useful.
- A **`--plain` non-Ink shell** for CI and non-TTY environments.
- A **VS Code extension** built from the same codebase.
- **LSP integration** for language-aware edits.

### Community governance, in practice

Being not-for-profit and community-driven is not just a tagline, it changes how the project behaves:

- **No paid tier, ever.** There is no "Nanocoder Pro" waiting in the wings. There is no feature artificially gated to push you to a hosted service.
- **No telemetry pipeline you cannot see.** Local-first means local-first.
- **The roadmap is public and contributor-led.** Contributions land directly in the project that ships.
- **Genuinely MIT.** No CLA that lets us relicense later, no open-core where the useful bits live behind a paywall.
- **No acqui-hire risk.** A community collective cannot be quietly bought and shut down. The worst case for Nanocoder is the community forks it and keeps going.

## When Pi is probably the better fit

- You agree with Pi's philosophy: minimal core, no MCP, no sub-agents, plans as files.
- You enjoy writing TypeScript extensions or having the agent write them for you.
- You want a tool that ships almost nothing and lets you compose everything.
- You like Pi's session tree and branching model, which is genuinely best-in-class.

That is a real and valid taste. Pi is good at it, and the team behind it is being unusually transparent about how they plan to handle the open-source-plus-company question.

## When Nanocoder is probably the better fit

- You care, on principle, about the tool between you and your code being community-owned and not-for-profit.
- You want a coding agent that is useful five minutes after `npm install -g`.
- You want MCP, sub-agents, plan mode, and scheduling without an opinion that they shouldn't exist.
- You care about running local models well, not just calling hosted ones.
- You want checkpoints, session resume, and safety scaffolding as defaults rather than extension points.
- You want a project whose structure cannot quietly change in the next funding cycle.

If that is you, give Nanocoder a try:

```bash
npm install -g @nanocollective/nanocoder
nanocoder
```

And if you would rather help shape it than just use it, the [[Community](https://docs.nanocollective.org/collective/organisation/community)](https://docs.nanocollective.org/collective/organisation/community) page is where to start.

## More information

The Nano Collective: https://nanocollective.org

Full documentation: https://docs.nanocollective.org

Governance and economics: https://docs.nanocollective.org/collective/organisation/governance and https://docs.nanocollective.org/collective/organisation/economics-charter