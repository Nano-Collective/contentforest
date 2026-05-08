---
kind: collective
slug: contentforest-launch
channel: reddit
generated_at: "2026-05-08T14:39:33.385Z"
model: "minimax-m2.7"
char_count: 6074
---

**TL;DR:** Multi-agent pipelines need measuring sticks to be effective, not just a model and a prompt. ContentForest took time to build its measuring sticks (brand guidelines, tone-of-voice docs, an llms.txt used as a grounded source of truth), and that foundation is what makes the pipeline genuinely autonomous rather than just generative. We're now extracting the engine as a configurable npm package so any repo can plug in its own measuring sticks.

---

Multi-agent workflows get a lot of attention. Fewer people talk about what makes one actually work in practice rather than produce plausible-sounding output.

A bit of context first: we're the [Nano Collective](https://nanocollective.org), a small group building open-source AI tooling for the community, not for profit. ContentForest is one of those tools. It sits next to [nanocoder](https://github.com/Nano-Collective/nano-coder), our general-purpose coding agent. ContentForest is a specialised release-content workflow that runs on top of it.

The problem we were solving: every Nano Collective product had its own GitHub Action for release content. Each one ran Claude on a manual trigger, used a Claude Code Action to draft posts, and dropped the output into the repo for someone to copy out. It worked, but it was per-repo, manually fired, and the same prompt produced visibly different content from one run to the next. Voice drifted across products and across runs of the same product. We wanted one pipeline, one set of rules, one consistent voice across every release we ship.

ContentForest is what replaced that setup. Same intent (automated multi-channel release content), but rebuilt around explicit measuring sticks: Minimax as the LLM, Nanocoder as the execution harness, brand rules and length rules baked into config the agent reads at runtime. It still didn't stay consistent at first. The model would generate well in one run and miss the mark in the next, even with the same prompt.

The gap was the measuring sticks!

## What "measuring sticks" actually means here

We had to write it down before the pipeline could enforce it. Brand voice, tone of voice, the specific terms to avoid, the channel length rules. We documented all of that before ContentForest could apply it reliably.

The brand guidelines define the voice as operational, understated, and honest, closer to engineering docs than marketing copy. They also list a small set of phrases that should never appear, regardless of how persuasive they sound in a first draft. That's not style preference; that's a content filter built from explicit documentation.

The llms.txt on our website acts as a persistent, markdown-shaped source of truth the model can reference. Brand voice, governance structure, project conventions, all in one file, versioned in the same repo as everything else. When the model needs to ground a claim about how the collective works, it has a canonical place to look rather than inventing from context.

## Self-validation as a structural part of the run

The agent doesn't just generate and hand off. It runs programmatic checks (required links, string length per channel, word count bounds) before considering its work done. If a check fails, the Nanocoder harness retries the run with a fresh context. Retry budget is per-agent, not global: each stage has its own shot count.

This is the part that makes the pipeline autonomous rather than just automated. The model evaluates whether its output meets the spec, not just whether it produced text. The measuring sticks are in the validation layer, not only in the prompt.

## Two agents with clear boundaries

The earlier draft used four agents: personal-account variants per team member. The problems were immediate: context fragmentation, token waste, and voice drift across a single run. The simplification wasn't a concession. Two agents with their own retry budgets are easier to reason about than four with shared context and no isolation. Announcement-layer agent first, depth-layer agent second (produces 0–3 articles only when a feature has enough depth to justify it). Draft, validate, ship.

## The human gate

The AI generates the PR and the markdown files. A human reviews and merges. The PR review is the approval step, built into the existing workflow. This matters on Reddit where "AI spam" is a legitimate objection: the content is AI-generated, but a person signed off on it. The measuring sticks reduce noise; the human gate prevents the rest.

## Making the engine portable

The thing that's specific to us is the *content* of the measuring sticks: our brand voice, our channels, our forbidden phrases. The engine that consumes those measuring sticks isn't specific to us at all.

So we're pulling the engine out into its own package: `@nanocollective/contentforest-core`. One config file (`contentforest.config.json`) points at your brand docs, your channel definitions, your validators. Drop it into any repo, run `contentforest generate --product foo --version 0.1.0`, get a brand-consistent content pack as a PR. Bring your own coding-agent runtime: nanocoder by default, with adapters planned for claude-code, codex etc.

The split is deliberate: the engine ships brand-neutral and reads voice from config; what you see us publishing here is one specific deployment of that engine, with our config, our prompts, our viewer. If the argument in this post lands for you, the test is whether you can describe your own measuring sticks well enough that a config file can encode them. If you can, the pipeline does the rest.

## Testing this live

We're running ContentForest on our own repos right now. The `/releases` folder in any of our repos shows the raw markdown output from the agents. You can see the measuring sticks in practice.

The Nano Collective builds open-source AI tooling not for profit, but for the community. If any of this resonates (the layered approach, the OSS angle, the engine-plus-config split), come find us at https://nanocollective.org.
