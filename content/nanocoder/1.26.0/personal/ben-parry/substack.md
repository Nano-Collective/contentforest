---
kind: personal
member: ben-parry
channel: substack
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:28:32.462Z"
model: "minimax-m2.7"
char_count: 13542
---

<!-- angle: Token economics and resource-aware design as the hidden architecture of AI tooling. Most tooling assumes abundance; designing from real constraints surfaces the tradeoffs that are normally invisible, and those tradeoffs encode values. -->

# The Hidden Architecture of Constraints

Most AI tooling is designed around the machine in front of you. Not the one you wish you had. The one with the most capacity. Build for the largest deployment, ship a throttled version for smaller setups. That assumption has costs that most people never see until they hit the wall.

Here is the concrete version: on a machine running a 1B parameter model with a 2048-token context window, a 700-token system prompt occupies roughly a third of the available space. That is not a minor overhead. It is a different ceiling. The model is given less room to think, and none of the tooling tells you that is happening unless you go looking for it.

That gap is the hidden architecture. Most teams never see it because they are not building for constrained hardware. The moment you are, the assumptions buried in every default decision surface all at once. What you thought was a universal tool reveals itself as a tool for a specific kind of machine, and you have to reckon with that.

This is not a story about Nanocoder. It is a story about what constraints reveal, and why designing for real resources rather than assumed ones is a clearer path to understanding what you are actually building.

## Executive Summary

- Most AI tooling assumes abundant context windows, compute, and memory. This assumption hides design decisions that matter when you are working with limited resources.
- Resource-aware design surfaces tradeoffs that are normally invisible. What you drop tells you what you think is negotiable. What you keep tells you what you think is essential.
- Designing for real constraints is not a compromise path. It is a discipline that forces explicitness. The decisions are visible. The tradeoffs are honest. You cannot hide behind abundance.

## Key Points

- A 700-token system prompt on a 2048-token context window leaves roughly 1,348 tokens for actual work. That is a different ceiling, not a configuration issue.
- Tool complexity should match model capacity, not just model capability. A 1B model can use any tool a 7B model uses, but the token cost is higher relative to the output.
- Nano mode removes find_files, list_directory, and agent - tools with high reasoning overhead that compound on small models. The result is 150-250 tokens against 500-700 in default mode.
- The architectural principle is resource-aware tool selection: matching what the model is asked to do to what the model can actually handle under its real constraints.
- Constraints force explicitness. Abundance lets you be vague about what matters. Tight resources make every decision a statement.
- Healthcare, education, and financial systems all run on hidden assumptions about capacity. Those assumptions become visible when the resources are not there.
- Architecture reveals values. The decisions embedded in a system - what stays, what goes, what gets optimized - are the values you cannot afford to be abstract about.
- Constraint-aware design applies beyond AI. The principle generalizes: design for the resources you have, not the resources you wish you had.
- The honest version of this argument must sit with the tradeoff. The only test is whether it works in practice: whether the design ships, whether people can use it, whether the tradeoff was worth it.

## What constraint-aware design looks like

When you design for real resources rather than assumed ones, the tradeoffs stop being theoretical. You cannot hold everything. Something has to go. The question is what, and the answer reveals something about what you think matters.

Nano mode removes three tools from the default set: find_files, list_directory, and agent. These tools have high reasoning overhead. On a large model that overhead is manageable. On a 1B model it compounds. The architectural decision is to match tool complexity to model capacity rather than model capability in a vacuum.

The distinction matters. Capability is what the model can do. Capacity is what the model can do under the constraints it actually runs under. A 7B model can manage a find_files call and return something useful. A 1B model can do it, but the token cost is higher relative to the output. The overhead eats into the space the model has to work with, and the work suffers for it.

The system prompt sections get compressed. Verbose blocks become minimal notes. Detailed OS and shell information becomes a one-liner. The result is a system prompt of roughly 150-250 tokens against 500-700 in default mode. The model gets more space to work with, and the ceiling is higher before it hits.

What you drop tells you what you think is negotiable. What you keep tells you what you think is essential.

## The principle behind the thing

The answer is not better tooling for constrained hardware. The answer is that most tooling hides its resource assumptions behind defaults nobody questions. When you surface those assumptions, you get a clearer picture of the architecture you actually have.

This applies beyond AI tooling. Healthcare runs on the assumption that hospitals have capacity. The moment a hospital runs at 110% occupancy, the assumptions surface and the design decisions embedded in the system become visible. Who gets treated first. Which departments get resources redirected. Which decisions were being made automatically because there was no constraint to force them to be made explicitly.

Education runs on assumptions about class sizes. A 30-student classroom is a design decision. It encodes assumptions about how much attention a teacher can give, how much noise a room can handle, how much space a child needs. When those assumptions are violated - 40 students, 25 square meters - the design breaks down, but the design was always there, even when it was invisible.

Financial systems assume liquidity. Not because markets are always liquid, but because liquidity is the assumption that makes the system simple to design and operate. When liquidity disappears, the design surfaces. Collateral calls, margin requirements, the speed at which positions need to be unwound - these were all design decisions, buried in assumptions that looked like descriptions of reality.

Every one of those assumptions is a design decision that looks like a description of reality until it is not. The architecture was always there. The constraint just makes it visible.

The reason this matters philosophically is that constraints force explicitness. When you have unlimited resources you can afford to be vague about what matters. You keep everything because you can. You do not have to choose. When resources are tight, every decision is a statement. What stays, what goes, what gets optimized for, what gets abandoned. The architecture reveals the values because the values have to be surfaced to make the tradeoffs.

Designing for real constraints is not a lesser path. It is a clearer one. The decisions are visible. The tradeoffs are honest. You cannot hide behind abundance.

## Reasoning traces and what they reveal about transparency

The same principle applies to reasoning traces. When a model shows its work - not just the output but the thought process - you stop treating the response as a black box.

This matters beyond the technical. A doctor who explains their reasoning is a doctor who can be held accountable for their reasoning. A lawyer who shows their thinking is a lawyer whose client can make an informed decision. A financial advisor who walks through their logic is a financial advisor whose client understands what they are agreeing to. In each case, the visible reasoning changes the relationship between the person using the tool and the output the tool produces.

Nanocoder now renders reasoning content from models that emit it - Codex GPT-5, DeepSeek-R1-style models, Anthropic extended thinking - as a collapsible Thought block above the response. It persists across conversation history and appears in logs. Control+R toggles expansion.

The architectural decision here was to render reasoning content as a first-class element rather than a debug output. That distinction matters. When reasoning is visible, you can evaluate whether the model's approach aligns with what you are trying to accomplish. When it is hidden, you can only evaluate the output. The difference is whether you are working with the tool or just using it.

## What you trade and what you gain

The honest version of this argument has to sit with the tradeoff.

Is constraint-aware design better? Or is it a compromise dressed up as a philosophy?

There is a version where designing for constrained hardware is exactly the right thing to do. It is where the real problem is. It forces you to be honest about what matters and what does not. The discipline it requires produces clearer architecture. That is the version I believe in.

There is also a version where this is rationalization. Where you call a workaround a design principle because it sounds better. Where the constraint you are working within is actually the limit of what is possible, not a different kind of possible, and calling it principled is self-deception.

Both versions are true simultaneously. That tension is real and I do not think it resolves cleanly.

The only honest test is whether it works in practice. Whether the design ships working software. Whether people can actually use it. Whether the tradeoff was worth it. The philosophy earns its keep by being true to the people who depend on it, not by being elegantly stated.

Build it. Ship it. See if it works. That is the only version of the argument that counts.

---

*Ben Parry is a co-founder of Ava Technologies and the Nano Collective. He writes about the architecture of AI systems, what it costs to build things, and the structural conditions that determine what is possible.*

*This essay is part of the Mind & Machine series - thinking about AI as it is built, not as it is marketed.*

[Mind & Machine on Substack](https://substack.com/@followbenparry)
