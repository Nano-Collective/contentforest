---
kind: collective
slug: one-year-old
channel: github-discussion
title: "One year of the Nano Collective: notes from the founder"
generated_at: "2026-08-29T21:06:21.932Z"
model: "minimax-m3"
char_count: 9824
---

A year ago today I started the Nano Collective as a side project around a coding agent I was writing called Nanocoder. I had no plan beyond "scratch my own itch and see if anyone else finds it useful". A year later, that side project is a small team shipping open-source AI tooling across several projects, with a public ledger, a charter, and a community. This post is the founder's-eye-view of what happened in the past year, what I'm proud of, what I got wrong, and what I want to be honest about going into year two.

## How it started

The thing that started it was Nanocoder. I wanted a coding agent that ran locally, that I could point at any model I wanted, and that didn't route my code and my prompts through somebody else's platform. That is a normal thing to want, and the tooling landscape at the time didn't really have it. So I started writing one.

The first versions were not great. They worked, and they were honest about what they were, but they were not something I would have asked anyone to use in anger. I open-sourced it anyway, because the only thing worse than an unfinished tool is an unfinished tool that I am pretending is finished. I am very glad I did, and I am very glad I did it as early as I did.

What happened next is the part that still surprises me. People actually showed up. Issues got filed. PRs came in from contributors I had never met. People wrote documentation. People ran the tool in anger and told me what broke. People sent model suggestions, bug repros, and small fixes I would never have written myself. People asked questions on Discord that I had not thought about, and people answered questions on Discord that I could not have answered.

That is the part of the story I want to be honest about: the side project did not become the Nano Collective because I had a plan. It became the Nano Collective because other people decided to help build it.

## What the Nano Collective is now

For anyone who has not heard of us: the Nano Collective is a community-led group of developers, designers, and maintainers building open-source AI tools for the people who use them. We build not for profit, but for the community. Everything we produce is open, transparent, and shaped by the people who rely on it. Every tool we ship aims to be **privacy-respecting**, **local-first**, and **open for all**. In that order.

The shape of the work today, roughly:

- **Nanocoder**, a coding agent in your terminal that runs on any model you choose. The project the whole thing started around.
- **Nanotune**, tooling focused on fine-tuning and improving small, local models for practical use.
- **Sentinel (alpha)**, an installable, Nanocoder-driven workflow that runs continuous, configurable security and code audits across the repositories in a GitHub organisation and files what it finds as issues.
- **get-md**, a fast, lightweight HTML, PDF, DOCX, and Markdown to Markdown converter optimised for LLM consumption.
- **json-up**, a type-safe JSON migration tool with Zod schema validation.
- **prompt-scrub**, a local-first tool that strips identifying content out of your prompts before they reach a cloud LLM.

All open-source, all under the [Nano-Collective](https://github.com/Nano-Collective) GitHub org, all built in the open.

## How the operating model works

Because people ask, and because this matters:

- The collective is fiscally hosted by the [Open Source Collective](https://opencollective.com/nano-collective) under whose legal and financial umbrella we operate. There is no separate legal entity of NC. Every payment in and out is visible on the public ledger, in real time.
- The [Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter) is the plain-language, publicly versioned commitment that sets out the financial terms for everyone who contributes. No investors, no profit-taking, no extraction. Funds cover infrastructure costs and contributor bounties.
- Decisions, governance, and roadmap conversations happen in public on GitHub and Discord. The whole point of the model is that contributors can see what is going on and have a real say in it.
- The [Brand Guidelines](https://docs.nanocollective.org/collective/organisation/brand) and the [Community page](https://docs.nanocollective.org/collective/organisation/community) set the voice and the conduct expectations. They are versioned, dated, and iterated on in public.
- The mission is explicitly to grow the contributor community and progressively decentralise. No single entity, including the founding team, can or should own this infrastructure long-term.

That is the operating system the work runs on. It is not incidental to what we are building, it is part of what we are building.

## What I've learned in the first year

A few honest reflections from the founder seat, in case any of it is useful to anyone else building something like this.

### The boring infrastructure is the trust.

The charter, the public ledger, the public governance, the docs that say how decisions get made. None of that is glamorous. It is also the reason anyone is willing to contribute seriously. People will not invest time into something they cannot see into. Writing the Economics Charter in plain language, on day one, before anyone asked for it, was the single most useful thing I did all year. I would do it again, and I would do it earlier.

### Show up before you have a polished thing.

I am very glad I open-sourced Nanocoder when it was rough. Waiting until it was good enough would have meant losing the early feedback that shaped it, and probably losing the early contributors that came with it. The lesson generalises: the early awkwardness of "we're figuring this out" is a feature, not a bug, because it invites people to help figure it out with you.

### Hire slow, even when you are a volunteer collective.

Adding someone to the core team is a standing responsibility for the collective as a whole, not a single project. We have been deliberate about that. The [Core Team](https://docs.nanocollective.org/collective/core-team) page describes the onboarding process in detail, partly because writing it down is the only way to keep it fair as the team grows.

### The community is the product.

This sounds like marketing copy. It is not. It is just what happens when you treat contributor experience and user experience as the same problem. The tools are downstream of the people building them. The docs are downstream of the people reading them. The governance is downstream of the people being governed. When you treat those as the same problem, you stop building things that have no one to maintain them.

### Say no, even when you have traction.

There are projects the collective has been asked to take on, and sponsors we have been offered, that I have turned down because they would have changed what the collective is. I expect to keep doing that. The charter and the brand guidelines exist to make those conversations easier to have, in writing, with the people who would otherwise be most likely to push back.

## What I got wrong

I would rather be honest about this than skip it.

- **Documentation lagged the work for the first six months.** I underweighted how much early contributors rely on docs to decide whether a project is worth their time. We have caught up, and the [docs site](https://docs.nanocollective.org) is the canonical home for everything collective-level, but the lag cost us some contributors we should have kept.
- **The first version of the Economics Charter was too legalistic.** Plain language matters more than I gave it credit for. We rewrote it.
- **I underestimated how much the core team needs explicit process.** "We all know each other" works for three people. It does not scale. We are still working through what good process looks like for a distributed, part-time core team, and that work is being done in the open.
- **Roadmaps were overpromised and under-detailed.** We have moved to per-project public roadmaps with explicit "planned" versus "in progress" versus "shipped" status. That is a better way to run a collective and I wish I had started there.

## What I am grateful for

This is the part I actually sat down to write.

To everyone who has installed a package, opened an issue, reviewed a PR, written a doc, translated a string, filed a security report, sponsored a project, run a workshop, drawn a diagram, or simply pointed a colleague at one of these tools when they needed it: thank you. The number of people who have done at least one of those things over the past year is much larger than I expected when I started, and the work is theirs as much as mine.

To the core team, who took a chance on a one-person side project and helped turn it into something that can outlive any of us: thank you. I would not be writing this post without you.

To the people who have pushed back on direction, including publicly, including when I was wrong: thank you. That is what the open part means.

## What is next

I don't want to overpromise. There is more work ahead than behind. More projects are in progress than have shipped. The governance model is being widened as we grow, not hardened. The contributor compensation model is being improved as we learn what actually works. The tooling keeps getting better, and the backlog keeps getting longer, and that is fine.

What I will say is: the people who are here are the right people to keep building this. The collective is in a healthier place than I would have bet on a year ago, and that is because of them, not me.

If you want to dig in, the home is [https://nanocollective.org](https://nanocollective.org). Everything is open, everything is documented, and the issues tab is the front door.

Here's to year two.

Will

Founder, Nano Collective