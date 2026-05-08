---
kind: collective
slug: contentforest-launch
channel: reddit
generated_at: "2026-05-01T17:59:45.689Z"
model: "minimax-m2.7"
char_count: 3637
---

**TL;DR:** We built a release content pipeline using Minimax as the LLM, Nanocoder as the execution harness, and git as the store — no CMS, no database. The key insight was that brand voice can live as a plain markdown file injected as a reference into each agent run, which sidesteps fine-tuning entirely.

---

The problem that got us here: writing release announcements by hand, over and over, in four channels, while trying to keep the brand voice consistent. It's tedious, it's specific to whoever writes it, and it doesn't scale. We needed something that could ingest release notes and produce channel-appropriate posts without us having to think about it every time.

The aha moment was when we realised that the brand voice — the thing we thought would require a fine-tuned model — could just be a markdown file in the repo. Inject it as a reference into each agent run, enforce it structurally via the prompt, and the model holds the voice without us having to train it. `_refs/collective/organisation/brand.md` — one file.

## The stack

The underlying LLM is **Minimax**. The agentic harness is **Nanocoder** — it provides the non-interactive execution environment and manages the retry (shot count) logic per agent. The content pipeline runs as a daily GitHub Action, no external infrastructure beyond that.

Git is the database. All output is markdown files committed to the repo. There is no CMS, no auth layer, no separate storage. The web UI is a read-only file viewer. That's the whole stack.

## Self-validation in-process

The first agent doesn't just generate and hand off. It runs programmatic checks — regex for required links, string length for platform limits, word count bounds — before considering its work done. If a check fails, the Nanocoder harness retries the run with a fresh context. The retry budget is per-agent, not global: each stage of the pipeline has its own shot count. This is the part I'd like to see more of in AI-assisted tooling — the agent doesn't just produce output, it evaluates whether the output meets the spec.

## Why two agents, not four

We ran an earlier draft with four agents — personal-account variants per team member. The problems showed up fast: context fragmentation, token waste, and what I'm calling voice drift — each agent was subtly shifting the register over a run, and the output was noticeably inconsistent even though they were all working from the same reference file.

The simplification wasn't a concession. Two agents with clear boundaries and their own retry budgets are easier to reason about than four with shared context and no isolation. Announcement-layer agent first, depth-layer agent second (produces 0–3 articles only when a feature has enough depth to justify it). Draft, validate, ship.

## Human in the loop

The AI generates the PR and the markdown files. A human reviews and merges. We are not shipping unfiltered output — the PR review is the approval step, built into the existing workflow. This matters on Reddit where "AI spam" is a real objection: the content is AI-generated, but a person signed off on it.

## Open-sourcing

We are considering whether this could be run by other organisations against their own repos with their own brand voice and channel set. That's genuinely exploratory — we want to see how the tool holds up in our own use first. No timeline, no commitment.

**We're testing this live on our repos.** You can check the `/releases` folder in any of our repos to see the raw markdown output from the agents.

The Nano Collective builds open-source AI tooling not for profit, but for the community. https://nanocollective.org
