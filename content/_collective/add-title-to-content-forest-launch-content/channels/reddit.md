---
kind: collective
slug: add-title-to-content-forest-launch-content
channel: reddit
generated_at: "2026-05-05T11:24:08.271Z"
model: "minimax-m2.7"
char_count: 3388
---

ContentForest is a tool the Nano Collective built to automate release content generation. I want to explain what it does, how it works under the hood, and why the architecture is worth talking about even if you have no interest in our specific products.

## What it does

ContentForest detects new releases across our product repos (Nanocoder, Nanotune, get-md, json-up) and runs a two-agent Nanocoder pipeline in non-interactive mode. The first agent drafts a multi-channel pack — LinkedIn, X, GitHub Discussion, Reddit — against our brand voice. A second agent produces 0–3 deeper-dive articles for features with enough depth to justify them. Both agents validate their own output against length and link rules before committing the result to git. A human opens the ContentForest app the next morning, reads the generated posts, and ships them.

This replaces a manual workflow that was specific to one product, manually triggered per release, and produced output we rewrote every time. ContentForest is product-agnostic, brand-enforced, and produces richer output.

## How it works

The daily GitHub Action scans our repos for new releases, builds a templated prompt from the release notes, and runs the agent pipeline. The prompts encode our brand voice (codified in `_refs/collective/organisation/brand.md`), channel rules, and length ceilings. The validators run in-process before the agent considers its work done. The content lands as markdown files in the repo — git is the database, there is no CMS.

The web UI is a Next.js app that serves as a read-only file viewer. The core team uses it to read and copy the generated content. That's it. No editing UI, no approval workflow baked into the software — the approval is the PR review process.

## Why the architecture is worth describing

Two things about this are structurally interesting, independent of whether you care about our products specifically.

The first is the self-validation step. We don't generate and hope. The agent checks its own output against hard rules — max chars, max words, required links — before returning. This is a pattern I'd like to see more of in AI-assisted tooling: the agent doesn't just produce output, it evaluates whether the output meets the spec, and retries if it doesn't. The retry budget is per-agent, not global — each stage of the pipeline gets its own shot count.

The second is the two-agent split. We went from an earlier draft with four agents (personal-account variants per team member) down to two: announcement-layer and depth-layer. The simplification wasn't a concession — it was a design decision. Two agents with clear boundaries and their own retry budgets are easier to reason about than four with shared context and no isolation. The pattern is now: draft, validate, ship.

## Where this goes next

The shape ContentForest demonstrates — software that coordinates agents and surfaces their work to humans — is the one we're using for other tools the collective is planning. Nothing named yet, nothing dated. The pattern is the point.

We're also exploring whether this could be open-sourced — whether other organisations could run the same pipeline against their own repos with their own brand voice and channel set. That's genuinely exploratory. We want to see how the tool holds up in our own use first. No timeline, no commitment.

The Nano Collective builds open-source AI tooling not for profit, but for the community. https://nanocollective.org