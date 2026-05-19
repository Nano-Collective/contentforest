---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-19T11:12:47.565Z"
model: "minimax-m2.7"
char_count: 4750
---

The most consequential decision you make about AI tooling isn't which model to run or which interface to use. It's who owns the infrastructure, and what that ownership means for what gets built next.

Most people don't think about it that way. They think in features: does this tool have MCP support? What's the context window? Is the UI fast? These are real questions. But they are downstream of a more fundamental one: what is this project's incentive structure, and does it align with mine?

I've been thinking about this a lot because Ava's agentic stack runs partly on Nanocoder, and the Nanocoder team just published a comparison with Pi. I want to work through the reasoning here in a way that applies beyond that specific comparison, to any tool decision you make in this space.

## The structure beneath the feature

Pi is a terminal coding agent built by Mario Zechner, who created libGDX. It started as a personal open-source project, MIT-licensed, built with real craft. Earlier this year it moved to Earendil, a company backed by Accel and Balderton. The Earendil team has been refreshingly transparent: the MIT core stays MIT, but commercial additions are coming on top of it.

That transparency is worth crediting. It's more honesty than most companies offer at this stage.

But here is the thing: transparency about the business model doesn't change the business model. Investors need returns. At some point, "what users actually need" and "what we need to monetise" stop being the same question. When they diverge, the answer tends in one direction, not because the people running the project are bad, but because that's how systems behave under investor pressure. The people change, the incentives don't.

Nanocoder is built by the Nano Collective, a not-for-profit, community-driven group. No VC, no holding company, no cap table, no exit pressure. The roadmap is open and contributor-led. We fund development through donations and consulting work, not by converting users into subscribers down the line.

That distinction matters more as AI tooling becomes more central to how teams work.

## Why architecture follows ownership

The technical difference between Pi and Nanocoder isn't arbitrary. It flows from the governance model.

Pi ships a minimal core: four tools, a short system prompt, and a well-designed TUI. The rest, sub-agents, MCP support, plan mode, skill templates, is expected to be assembled by the user through TypeScript extensions. This is a coherent position. Zechner has written about why he thinks MCP is context-heavy overhead, why sub-agents are black boxes, why plans are better as markdown files you edit together.

Nanocoder ships those as defaults. MCP loads from a config file at startup. Sub-agents are a built-in primitive. Plan mode is a top-level mode with its own UI. Scheduling runs on cron with interactive tools auto-disabled for unattended runs.

These aren't arbitrary additions. They reflect an assumption: a local-first coding agent should be useful the moment you install it. That assumption only survives in a governance model where the people deciding what to build don't eventually need to monetise the user's reliance on those features.

When a project is eventually going to need a revenue model, shipping everything as a default creates a problem: what do you charge for? So the architecture tends toward minimal cores, with extensions and additions as the monetisation surface. When a project doesn't need to monetise, it can ship the full workflow as a default, because the value flows to the community, not to a future paid tier.

I am not saying Pi made the wrong choice. For a VC-backed project, a minimal core with extension points is probably the only coherent architecture. I'm saying the architecture tells you something about who the project answers to.

## The real question for teams

If you're running a consultancy, a small studio, or an internal team, the tool you pick today is the tool your team will build its habits around. You'll write scripts in its extension system. You'll trust its session management. You'll integrate it into your workflow in ways that create real switching costs.

The question isn't which feature set you prefer in week one. It's who you'll be answering to when the project makes its next strategic decision, and whether that aligns with the people using it.

I've been through this at Ava. We needed an agentic stack that wasn't going to quietly shift its priorities in the next funding cycle. Not because we distrust the people running any particular project, but because the structural incentives in the VC model are well-understood, and we didn't want to build on top of them.

Nanocoder was the answer because the Nano Collective's structure makes the answer durable. A community collective can't be quietly acquired and shut down. The worst case isn't "it disappears", it's "the community forks it and keeps going." That's a different risk profile than a VC-backed project, and for infrastructure that your team relies on daily, that difference compounds.

## What this means in practice

If you're evaluating tools in this space, I'd suggest asking:

- Who owns the project, and what are their obligations to those investors?
- Does the architecture reflect a need to create monetisation surface, or a need to serve the community?
- Is there a paid tier on the horizon, and does the current architecture make that easier or harder to resist?
- Can the project change hands without fundamentally changing what it is?

These questions don't have objective answers, they depend on your own risk tolerance and use case. But they are worth asking before you build your workflow around something.

The comparison Nanocoder published is at nanocollective.org if you want the full technical picture. And I write about this class of question regularly in Mind & Machine, the structural stuff, the governance layer, what it means in practice for teams building on this infrastructure.

https://nanocollective.org