---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: pi-versus-nanocoder
generated_at: "2026-05-15T14:00:47.687Z"
model: "minimax-m2.7"
char_count: 4262
---

Every tool ships a philosophy, whether the builder knows it or not.

The question is whether the philosophy serves you, or whether it serves something else entirely.

Pi and Nanocoder are both terminal-based AI coding agents. They solve roughly the same problem. They took fundamentally different architectural bets, and those bets compound over time into very different experiences.

The most obvious difference is feature inventory. Pi is built around a clean, composable TypeScript core. Extensions, subagents, plan mode, MCP: these are TypeScript packages you bring to the party. Nanocoder ships them as first-class features. Plan mode is a top-level shift-tab toggle with its own UI, not a third-party plugin you find on npm.

But listing features is the wrong frame. What matters is the philosophy underneath the feature list.

Pi's philosophy: composability is the product. The core is small, clean, and extendable. The user assembles what they need. This is a legitimate and well-executed bet. A clean API with good abstractions lets you build precisely what you want, if you have the time and inclination to build it.

Nanocoder's philosophy: useful out of the box is the product. The features that get shipped are the ones the community actually uses, not the ones that live in a plugin registry waiting to be found. The Ink-based terminal UI gives you a proper interactive surface: tool confirmations, formatted diffs, file explorers, session resume, without touching a config file.

These are not the same bet. And they do not converge over time.

A composable tool can add more to its core, but it has to do so without breaking the abstraction it sold you. Every first-class feature in Nanocoder was a deliberate decision that the feature was part of the product, not an extension layered on top of a minimal harness. That constraint is liberating. It forces coherence.

Here is what that looks like in practice.

The TUI is built with React and Ink.js. Four modes are available without any configuration: normal (confirm each tool), auto-accept (auto-run safe tools, prompt for bash and destructive git), yolo (run everything, your call), and plan (show tool calls without executing). None of these are plugins. None of them require a separate install.

Ollama is a first-class provider, not a checkbox in a settings menu. This matters because local-first means local-first, not "we support local models as an edge case, use OpenAI as your default." Small models good at agentic coding are an active area of investment, not a footnote.

MCP servers load at startup from config. Subagents live in `source/subagents/` as a built-in primitive. Checkpoint manager and file snapshots are in the core. These are not aspirational. They shipped, and they work.

What does this have to do with the collective's legal structure?

Everything, actually.

The Nano Collective is a not-for-profit, community-driven group. No VC. No cap table. No exit pressure. This is not the kind of thing you say in the README and move on. It is an architectural constraint that shapes every decision made inside the project, including what ships, who it ships for, and what "done" looks like.

A community collective cannot be quietly acquired and shut down. The worst case is a fork, and the community keeps going. That changes what "long-term" means. It changes what a roadmap commitment is worth. It changes whose interests the project is optimised for.

The philosophical bet underneath Nanocoder: useful out of the box, local-first, no telemetry you cannot see, is only credible if the entity shipping it can make that bet stick. A VC-backed project cannot make that commitment indefinitely, because the investors can change the terms. The collective's legal structure makes the bet stick.

These two things are not separate: the features and the legal structure. They are the same bet, expressed differently.

If the machine belongs to the user, the tooling should serve the user. That means shipping features users actually need rather than building a plugin ecosystem around a minimal core. It means treating local model support as a first-class concern, not an add-on. It means making the roadmap public and letting the community shape what comes next.

The alternative: a minimal core, a clean API, a rich plugin ecosystem. This is a coherent philosophy. It is the philosophy of a tool that trusts the user to build what they need. It is also the philosophy of a tool that can remain lightweight while the ecosystem grows around it.

But it is also the philosophy of a tool that offloads the assembly work to the person using it. And that is a real cost, even if it does not show up on the feature list.

Which philosophy serves you depends on what you are trying to do, and whether the machine is yours.

If the architecture is right, it does not have to be maintained by a specific entity. The incentive structures that built it are structural, not personal. That kind of resilience is not an accident.

More on the architecture: https://nanocollective.org