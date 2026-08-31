---
kind: collective
slug: one-year-old
channel: reddit
generated_at: "2026-08-29T21:06:21.932Z"
model: "minimax-m3"
char_count: 7001
---

I'm Will, the founder of the Nano Collective. A year ago today I started this as a side project around a coding agent I was writing called Nanocoder. I had no plan beyond "scratch my own itch and see if anyone else finds it useful". A year later, the side project is a small team shipping open-source AI tooling across multiple projects, with a public ledger, a charter, and a community. Sharing the story here because the people who care about open-source, local-first AI tooling are exactly the people who made this work.

**Where it started**

Nanocoder was the original thing. The motivation was simple: I wanted a coding agent that ran locally, that I could point at any model I wanted, and that didn't route my code and my prompts through somebody else's platform. That is a normal thing to want, and the tooling landscape at the time didn't really have it. So I started writing one.

The first versions were not great. They worked, and they were honest about what they were, but they were not something I would have asked anyone to use in anger. I open-sourced it anyway, because the only thing worse than an unfinished tool is an unfinished tool that I am pretending is finished.

What happened next is the part that still surprises me. People actually showed up. Issues got filed. PRs came in from contributors I had never met. People wrote documentation. People ran the thing in anger and told me what broke. People sent me model suggestions and bug repros and small fixes that I would never have written myself. That is the part of the story I want to be honest about: the side project did not become the Nano Collective because I had a plan. It became the Nano Collective because other people decided to help build it.

**What the Nano Collective is now**

For anyone who has not heard of us: the Nano Collective is a community-led group of developers, designers, and maintainers building open-source AI tools for the people who use them. We build not for profit, but for the community. Everything we produce is open, transparent, and shaped by the people who rely on it. Every tool we ship aims to be privacy-respecting, local-first, and open for all.

The shape of the work today, roughly:

- **Nanocoder**, a coding agent in your terminal that runs on any model you choose. The project this whole thing started around.
- **Nanotune**, tooling focused on fine-tuning and improving small, local models for practical use.
- **Sentinel (alpha)**, an installable, Nanocoder-driven workflow that runs continuous, configurable security and code audits across the repositories in a GitHub organisation and files what it finds as issues.
- **get-md**, a fast, lightweight HTML, PDF, DOCX, and Markdown to Markdown converter optimised for LLM consumption.
- **json-up**, a type-safe JSON migration tool with Zod schema validation.
- **prompt-scrub**, a local-first tool that strips identifying content out of your prompts before they reach a cloud LLM.

All open-source, all under the `Nano-Collective` GitHub org, all built in the open.

**How the operating model works**

Because people ask, and because this matters:

- The collective is fiscally hosted by the [Open Source Collective](https://opencollective.com/nano-collective) under whose legal and financial umbrella we operate. There is no separate legal entity of NC. Every payment in and out is visible on the public ledger, in real time.
- The [Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter) is the plain-language, publicly versioned commitment that sets out the financial terms for everyone who contributes. No investors, no profit-taking, no extraction. Funds cover infrastructure costs and contributor bounties.
- Decisions, governance, and roadmap conversations happen in public on GitHub and Discord. The whole point of the model is that contributors can see what is going on and have a real say in it.
- The mission is explicitly to grow the contributor community and progressively decentralise. No single entity, including the founding team, can or should own this infrastructure long-term.

That is the operating system the work runs on. It is not incidental to what we are building, it is part of what we are building.

**A year in, what I've learned**

A few honest reflections from the founder seat, in case any of it is useful to anyone else building something like this:

1. **The boring infrastructure is the trust.** The charter, the public ledger, the public governance, the docs that say how decisions get made. None of that is glamorous. It is also the reason anyone is willing to contribute seriously. People will not invest time into something they cannot see into.
2. **Show up before you have a polished thing.** I am very glad I open-sourced Nanocoder when it was rough. Waiting until it was good enough would have meant losing the early feedback that shaped it, and probably losing the early contributors that came with it.
3. **Hire slow, even when you are a volunteer collective.** Adding someone to the core team is a standing responsibility for the collective as a whole, not a single project. We have been deliberate about that, and it has paid off.
4. **The community is the product.** This sounds like marketing copy. It is not. It is just what happens when you treat contributor experience and user experience as the same problem. The tools are downstream of the people building them.

**What I am grateful for**

This is the part I actually sat down to write.

To everyone who has installed a package, opened an issue, reviewed a PR, written a doc, translated a string, filed a security report, sponsored a project, run a workshop, drawn a diagram, or simply pointed a colleague at one of these tools when they needed it: thank you. The number of people who have done at least one of those things over the past year is much larger than I expected when I started, and the work is theirs as much as mine.

To the core team, who took a chance on a one-person side project and helped turn it into something that can outlive any of us: thank you. I would not be writing this post without you.

To the people who have pushed back on direction, including publicly, including when I was wrong: thank you. That is what the open part means.

**What is next**

I don't want to overpromise. There is more work ahead than behind. More projects are in progress than have shipped. The governance model is being widened as we grow, not hardened. The contributor compensation model is being improved as we learn what actually works. The tooling keeps getting better, and the backlog keeps getting longer, and that is fine.

What I will say is: the people who are here are the right people to keep building this. The collective is in a healthier place than I would have bet on a year ago, and that is because of them, not me.

If you want to dig in, the home is https://nanocollective.org. Everything is open, everything is documented, and the issues tab is the front door.