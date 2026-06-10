---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: 70k-downloads-milestone
generated_at: "2026-05-12T11:06:28.191Z"
model: "minimax-m3"
char_count: 2890
---

There's a structural difference between a tool that succeeds because it was built well, and one that succeeds because it has to.

Open-source software mostly operates in the second category. Its survival depends on being genuinely useful - not on hitting a revenue target, not on converting free users into paying ones. The incentive structure points in a different direction.

The Nano Collective crossed 70,000 downloads this weekend. Five packages: Nanocoder, Nanotune, get-md, json-up. Every one of them runs locally, stays open, and doesn't route your code or your queries through a third-party platform.

That's what the number means architecturally.

## What we build and why the architecture looks the way it does

Most commercial AI tooling is sold as a service: you sign up, you hand over your prompts, the platform processes them and returns a result. The relationship is one-sided - the platform sets the terms, can change them, and has an ongoing incentive to extract more value from the relationship over time. This isn't malice. It's structure. Systems behave according to their incentives.

The Nano Collective builds differently. Every package is a local tool. Nothing is hosted, nothing is logged to a platform you don't control, nothing requires an account. The code is open - you can read it, fork it, audit it, modify it. If a tool stops serving you, you can take what you've learned and build something that does.

This isn't a feature list. It's a structural argument. The reason the tools are architected this way is that the Nano Collective has no investors, no equity, and no structural pressure to build a business model on top of your work. That's by design - not idealism, but architecture. What you're seeing in 70,000 downloads is people choosing tools that are aligned with their interests because the incentive structure inside the collective is aligned with their interests.

## What this looks like in practice

Nanocoder runs locally and wraps the Nanocoder agent in a pseudo-terminal, giving you control over how the model operates and what it has access to. ContentForest generates release content through a pipeline of agents without routing anything through a centralised service. Nanotune works with local model configurations so your tuning data never leaves your environment. get-md and json-up are utilities that do specific things and stay out of your way.

None of these require an account. None of them phone home. The work happens on your hardware, in your environment.

## The principle behind the structure

A tool is only as trustworthy as the structure that produced it. If trust is required - if you need to believe the organisation running it has your interests at heart - then the architecture has failed. The answer isn't better founders with better intentions. It's better architecture.

Compare that to healthcare. A good doctor is valuable, but a system that makes doctors financially dependent on insurance companies produces different outcomes than a system where doctors are paid directly by patients. The structure of payment shapes the behaviour. The same logic applies to tooling.

If you're using a commercial AI platform, the platform's incentives are not the same as yours. That doesn't mean the tool is bad. It means the relationship has a structural asymmetry that will express itself over time. When open-source alternatives exist - alternatives that are aligned with your interests by design - people notice. 70,000 downloads is people noticing.

## What's next

The packages continue. Each one has its own roadmap, and direction is discussed in the Nano Collective's GitHub Discussions. If you want to contribute - code, docs, feedback - every project has open issues tagged for contribution.

If you've found these tools useful and want to follow where the thinking goes, Mind & Machine looks at the architecture of AI systems: [https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728](https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728)

Otherwise - [https://nanocollective.org](https://nanocollective.org)
