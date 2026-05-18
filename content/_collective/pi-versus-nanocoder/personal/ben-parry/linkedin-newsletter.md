---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-18T14:54:55.763Z"
model: "minimax-m2.7"
char_count: 4072
---

A month or two ago, Pi was a solo MIT-licensed project. A single developer, no investors, no cap table. The kind of thing that could fork, fork again, or just keep going indefinitely because the maintainer felt like it.

Then it was acquired. Earendil, backed by Accel and Balderton. The announcement was honest about commercial plans. The legal code is unchanged. The licence is unchanged. The team is still there.

But the structure changed. And the structure is the thing that matters.

## Why structure is not a side issue

Here is what happens in a venture-backed AI tool company. At some point - not immediately, not always consciously - the roadmap has to support a business model. Not because the people are bad, but because the architecture of capital has a direction of travel. Someone backed it, someone expects a return, and the return has to come from somewhere. Pricing, features, data, the edge between free and paid. These are not arbitrary decisions. They are structural pressures.

I am not saying this to condemn venture capital. Plenty of good things have been built that way. But the thing sitting between a developer and their code is not a neutral tool. It is infrastructure. And infrastructure with the wrong ownership structure eventually stops being the tool you chose.

The question I keep returning to is not "which tool is better?" but "which tool will still be the tool I chose in five years, after the next funding round, the next pivot, the next acquisition rumour?"

## What the Nano Collective looks like on the inside

Nanocoder is built by the Nano Collective, a not-for-profit, community-driven group. There is no holding company. No investor deck. No exit path built into the design.

Practically, this means a few things that matter more than they sound:

The roadmap is public and contributor-led. Not in the sense of a public issue tracker that nobody responds to, but in the sense that contributions land in the core without routing through a company with its own priorities. If you want plan mode, you can actually get it into the core. The barrier is code review, not corporate strategy.

There is no paid tier, and there is no feature that will be gated behind one later. Not because the collective has more willpower than a startup, but because the structure does not require it to exist. There is no investor expecting a paywall to justify their fund. The tool either serves the community or it does not.

On the local-first side: Nanocoder treats Ollama as a first-class provider. This is an architectural decision, not a feature request. The assumption is that a local-first coding agent should work well with models on your machine, not just with frontier API calls. That assumption shapes every provider integration, every model handling path, every latency consideration. It is easier to maintain that assumption inside a collective than inside a company that has hosting revenue to protect.

## The Pi comparison, honestly

Pi takes a different view. A minimal core - four tools, a short system prompt - and the expectation that you will extend it. Sub-agents, plan mode, MCP, scheduling: you build those. That is a legitimate philosophy, and if you want the smallest possible harness and you enjoy composing your own tooling, Pi is well-built for it.

But it reflects a different set of constraints. A minimal core is easier to maintain. It is easier to make money on top of. It keeps the extension layer thin, and the thin extension layer is where commercial offerings live.

Nanocoder ships those as first-class features because the community that builds it also uses it. The people deciding what gets built are the people using it every day. That alignment is structural, not cultural. It comes from having no one who needs the extension layer to be the business model.

## The principle behind it

I keep thinking about what it means to own your infrastructure. Not in an ideological sense - I am not making the case that community-owned tools are morally superior. I am making the case that they are structurally different, and that the structural difference shows up over time, not at the moment of comparison.

The worst case for a community collective is a fork. Someone takes the code, changes the direction, moves on. The original keeps going. The worst case for a VC-backed project is quieter: a gradual shift in what the tool is for, a paywall that lands when the fundraising cycle requires it, a data policy that changes when the business model demands a new revenue line.

Neither is guaranteed. But one of them is structurally prevented. The other is structurally incentivised.

The roadmap is at nanocollective.org, and if you want to dig into the technical decisions behind how Nanocoder is structured - the Ink-based TUI, the provider architecture, the mode system - the GitHub is the right place.

---