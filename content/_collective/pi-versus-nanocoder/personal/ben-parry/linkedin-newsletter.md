---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-19T19:31:33.919Z"
model: "minimax-m2.7"
char_count: 2842
---

Most people comparing AI coding tools focus on features. How many tools does it have? Does it support MCP? What models does it work with? These are reasonable questions. They are also the wrong place to start.

The question worth asking is: who owns this, and what does that ownership make likely?

## The acquisition no one talked about

Pi started as Mario Zechner's solo MIT project. He built it carefully, shipped it, and left it open for anyone to use. It was one of the more thoughtful terminal coding agents available. In April 2026, a VC-backed company called Earendil acquired it, backed by Accel and Balderton. They published an RFC explaining their plans. The core would stay MIT. Commercial work would be built on top. They were more honest about it than most.

That honesty matters. But it is not the same as architecture.

Earendil has investors. Investors eventually need a return. The RFC mentions commercial offerings are coming, but they don't know what yet. When the roadmap has to support a business model, "what users need" and "what we need to monetise" can stop being the same question. And when they diverge, the answer tends in one direction. That is not a character flaw in anyone working there. It is how incentive structures work.

## What Nanocoder is built on

Nanocoder is built by the Nano Collective. We are not a company. There is no VC, no cap table, no holding entity. The roadmap is public and contributor-led. Development is funded through donations and consulting work, not by eventually converting users into subscribers.

This is not the feel-good version of why the architecture matters. It is the structural version.

A tool that sits between a developer and their code, which writes, edits, and manages that code, is the wrong kind of thing to be owned by a corporation with shareholders. The incentive to extract value from that position is strong, and it only takes one acquisition, one pivot, one new CEO with a different vision, for the tool you rely on to become something you no longer recognise.

We built Nanocoder the way we did because we believe the tool between you and your code should not be able to do that to you. Not because we are idealistic about open source. Because we think the architecture makes the difference.

## What this looks like in practice

Pi ships a minimal core: four tools and a short system prompt. MCP, sub-agents, plan mode, these are TypeScript extensions you add yourself. That is a coherent design philosophy, and if you agree with it, Pi is built for you.

Nanocoder takes the opposite view: a local-first coding agent should be useful the moment you install it. MCP servers load from config at startup. Sub-agents are a built-in primitive. Plan mode is a first-class UI, not a markdown convention. Scheduling runs on cron, with interactive tools auto-disabled for unattended runs. These are features we think every user should have access to without assembling them themselves.

On the local-first side: Ollama is a first-class provider, not an afterthought. We invest in making small local models work well at agentic coding tasks, not just wiring up frontier API calls. The TUI is built with React and Ink.js, and gives you tool confirmations, formatted diffs, file explorers, status bars, notifications. Four modes are baked in and toggled with Shift+Tab: normal, auto-accept, yolo, and plan.

There is no paid tier. There is no telemetry you cannot see. The roadmap is public. And the structure cannot quietly change in the next funding cycle.

## Why the structure matters beyond ideology

The pattern shows up everywhere once you start looking. Healthcare systems built around patient care get restructured around billing efficiency. Law firms with strong cultures get acquired and slowly shift toward extracting value from partners. The architecture of a thing shapes what it becomes.

This is not a story about villains. It is a story about incentives. The question is not "do I trust this company today?" It is "what does the structure make inevitable over five years?" Answer that question, and the features stop mattering as much.

The Nano Collective cannot be quietly acquired and shut down. The worst case for Nanocoder is the community forks it and keeps going. That is not a guarantee of longevity. It is a guarantee of the right failure mode.

We are building something that stays. Not because we are immune to pressure, but because the structure makes pressure the wrong lever.

More on all of this at [nanocollective.org](https://nanocollective.org).