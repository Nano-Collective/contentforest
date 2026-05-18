---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-18T14:42:22.287Z"
model: "minimax-m2.7"
char_count: 3410
---

When Mario Zechner published Pi as a solo MIT project, it was a clean answer to a real problem: a terminal coding agent with a small feature set and a clean API for extension. No VC, no cap table, no obligations.

That's a different structure than what it has become. Earendil, backed by Accel and Balderton, acquired Pi. The team has been transparent that commercial offerings are coming on top of the MIT core. That's more honest than most acquisitions, but it doesn't change the structural reality: the project now answers to investors who need a return. The roadmap is no longer decided by the people using the tool.

I've been thinking about this because it maps onto something I see in legal tech and healthcare: the moment an infrastructure layer becomes mission-critical, it becomes a target for acquisition. The language of the mission often survives. The structure doesn't.

## What makes a coding agent accountable to its users

The Nano Collective builds Nanocoder on a different assumption: that the tool between a developer and their code is too important to hand to a company that might not exist in the same form two years from now. Not because I distrust any particular company, but because the history of infrastructure software is full of examples where the incentives of the owner diverged from the incentives of the user, and the users found out too late.

Nanocoder is a not-for-profit, community-driven collective. No VC. No holding company. No exit pressure. The roadmap is public and decided by contributors and users. When a community collective gets acquired, the community forks it and keeps going. Accountability lives in the structure, not in the goodwill of any individual founder.

## First-class local model support

Nanocoder treats Ollama as a first-class provider, not an afterthought. We invest specifically in making small local models work well for agentic coding tasks, because a coding agent that only works through frontier API calls is a different product with different failure modes. The provider layer uses Vercel AI SDK v6 with dedicated Anthropic and Google providers, plus an OpenAI-compatible layer. There's an XML tool-call fallback path for models that don't support native tool calling, which keeps smaller local models useful.

## The TUI as a safety surface

The React + Ink.js interface isn't just aesthetics. Tool confirmations, formatted diffs, session autosave, and file snapshots are the safety scaffolding that makes an agent willing to run bash and git operations something you can actually work with daily. The directory trust check on first run in a new folder means the system asks you once and remembers.

## Modes that ship with the tool

Pi ships a minimal core and asks you to add plan mode and auto-accept through TypeScript extensions. Nanocoder takes a different view: a local-first coding agent should be useful the moment you install it.

Four modes are baked in, toggled via Shift+Tab: normal (confirm each tool), auto-accept (auto-run safe tools, prompt for destructive operations), yolo (run everything), and plan (show tool calls without executing). Plan mode has its own UI. Subagents are a built-in primitive. MCP servers load from config at startup. Scheduled agents run on cron with interactive tools auto-disabled for unattended runs.

The lowest rung for custom commands is a markdown file in `.nanocoder/commands/`. No TypeScript module. No build step.

## The principle underneath it

These decisions are all downstream of the same structural question: what does it mean for a coding agent to be accountable to the people using it?

Subagents, MCP, plan mode, and session resume are in Nanocoder because they're what users actually need, not because they fit a revenue model. Ollama as a first-class provider is there because a collective that believes AI tooling should run on the user's hardware will naturally invest in making that work well. The no-paid-tier policy is there because a community collective with no cap table has no reason to gate features.

Pi is a well-built tool. But after the acquisition, the question I keep coming back to is structural: who does this project answer to, and does that align with who I want my tools to answer to?

The answer isn't better founders. It's better architecture.

What's next for Nanocoder? The architectural direction is consistent: better local model support, deeper MCP integration, the things that make a community-owned coding agent more useful. The roadmap is public and contributor-led. If you want to see what's coming or shape it, the place to go is nanocollective.org.

---

*Mind & Machine is a newsletter about the systems underneath AI tools - what they reveal about how technology is structured, and what that means for the people who build and work with software. Published at nanocollective.org.*