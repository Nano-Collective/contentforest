---
kind: collective
slug: contentforest-launch
channel: github-discussion
generated_at: "2026-05-01T17:59:45.689Z"
model: "minimax-m2.7"
char_count: 4153
---

The Nano Collective has shipped ContentForest — a tool that automates release content generation across our product stack. This post is a walkthrough of what it does, how it works, and why the shape it takes matters for what we're building next.

## The pattern: agents do the work, software gives humans the outputs

The starting point is a belief about where AI tooling is going: the interesting software isn't the AI itself — it's the software that coordinates agents and surfaces their work to humans in a form that's useful to act on.

ContentForest is the first concrete example of that shape at the collective. A release lands in one of our product repos. Overnight, an agent pipeline reads the release notes, drafts a coherent multi-channel pack against our brand voice, validates the output against length and link rules, and commits the result to git. A human opens the app the next morning, reads what the agents produced, and ships it. The agent did the writing. The software did the orchestration. The human kept the judgement call.

This is deliberately different from how release content has been handled before — which was ad-hoc, manually triggered per product, and produced output that needed rewriting every time.

## How ContentForest works

ContentForest runs as a members-only Next.js app at `contentforest.nanocollective.org`. The generation pipeline is a daily GitHub Action that:

1. **Detects releases** across Nano Collective product repos — Nanocoder, Nanotune, get-md, json-up — using GitHub's release event feed.
2. **Runs a two-agent Nanocoder pipeline** in non-interactive mode. The first agent (`release-channels`) produces channel posts (LinkedIn, X, GitHub Discussion, Reddit) plus per-feature articles. The second agent (`article-channels`) produces 0–3 deeper-dive drip articles for features with enough depth to justify one.
3. **Self-validates at spawn** — each agent runs an in-process check against length and link rules before committing.
4. **Commits the pack to git** as markdown files. Git is the database. There is no CMS.

The web UI is a file viewer — the core team reads the generated posts, copies what they need, and ships it through their channels of choice.

## Why the architecture looks the way it does

The "git is the database" choice deserves a brief note. It's not the headline — it's not the gimmick. It exists because the content is already version-controlled, already reviewable in a PR, and already consistent with how the collective manages everything else it ships. Adding a database layer on top of that would have been adding complexity for its own sake.

The two-agent design (replacing an earlier, more elaborate multi-agent draft) reflects a deliberate simplification: one agent produces the announcement-layer posts, a second produces the depth articles. Each has its own retry budget, its own validator, and a clear boundary.

The brand enforcement is built into the agent prompts — the channel posts are generated against the Nano Collective brand voice, which is codified in `_refs/collective/organisation/brand.md` and enforced by the in-spawn validator.

## What's next

ContentForest is the first tool the collective has shipped along this pattern. The shape — software that coordinates agents and surfaces their work to humans — is the one we're repeating.

There are other tools along the same shape in various stages of planning. Nothing to name yet, nothing to promise. The pattern is the point; specific tools will show up when they're ready.

We're also exploring whether the underlying architecture could be open-sourced — whether other organisations could run ContentForest against their own repos, with their own brand voice and channel set. That's exploratory, not committed. We want to see how the tool holds up in our own use first. If that changes, we'll say so.

The Nano Collective is a community-led group of developers, designers, and maintainers building open-source AI tooling not for profit, but for the community. Everything is open, transparent, and shaped by the people who rely on it. Learn more at https://nanocollective.org
