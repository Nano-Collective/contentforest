---
kind: collective
slug: new-website-launch
channel: github-discussion
title: "New Nano Collective website: principles first, live proof, tighter codebase"
generated_at: "2026-06-27T21:04:36.123Z"
model: "minimax-m3"
char_count: 7438
---

The Nano Collective has relaunched its website. This post is a walkthrough of what changed, why, and what it sets up for the next round of announcements.

The starting point is the same one we use for the docs site and the READMEs: the [Brand Guidelines](https://docs.nanocollective.org/collective/organisation/brand) are the source of truth for how the collective is talked about and presented. The previous site drifted from those guidelines in several places. The new site is an attempt to remove that drift.

## The headline change: principles lead

The three principles the collective holds itself to (**Privacy First, Open Source, Local First**) now lead the homepage in the order they appear in the brand guidelines: privacy-respecting, local-first, open for all. That ordering is not decoration. It is the filter applied when deciding what the collective builds, how it builds it, and who gets to shape it.

The previous version had these principles further down the page, framed as values. They are not values. They are the filter. The redesign puts them where the filter belongs.

A note on why this matters for the projects specifically. The principles page in the brand guidelines spells out that the second paragraph of the canonical collective description can be dropped where space is tight, but the principles should never be paraphrased loosely. The site now reflects that. The same three phrases appear in the same order wherever they show up.

## Information architecture

Two structural changes to how the site is organised:

**1. Flagship projects get landing pages.** [Nanocoder](https://github.com/Nano-Collective/nanocoder) and [Nanotune](https://github.com/Nano-Collective/nanotune), the two projects most often pointed at when introducing the collective, each have a dedicated landing page now. The previous site had a single paragraph for each. The new pages describe what the project does, link to the repo, link to the docs, and stay in the same voice as the project's own README.

**2. The full project list is alphabetised on its own page.** The four shipped projects (Nanocoder, Nanotune, get-md, json-up) are listed in alphabetical order on the projects page, with one paragraph each and a link to the corresponding repo. The brand guidelines ask for alphabetised listings unless there is a deliberate reason to prioritise; with the landing pages for the two flagship projects carrying the bulk of the weight, the projects page can default to alphabetised.

get-md and json-up are worth naming explicitly. They often get skipped in copy that leads with the AI-shaped projects, but they are real, shipped, maintained tools under the umbrella. The new site gives them the same one-paragraph treatment as the others.

## Live proof replaces curated snapshots

The old "community" section was a curated screenshot of activity: a Discord message, a GitHub notification, a Reddit thread. The new site has:

- **Live GitHub, Discord, and Reddit stats** on the homepage, updated in real time rather than maintained by hand.
- **A public growth page** that plots the same data over time, so the trajectory is visible to anyone who wants to look.
- **A feed of the latest discussions** surfaced directly from the relevant channels.

These are small changes in isolation, but they matter for the same reason the [Open Collective ledger](https://opencollective.com/nano-collective) matters for finances: live data is harder to misrepresent than curated data. The collective's stated commitment to transparency by default is now extended to its own growth metrics.

A **public analytics page** also ships with the redesign. The collective treats its own site the same way it treats the projects it ships: traffic patterns are visible to anyone who wants to look.

## The branded asset generator

One of the smaller-but-meaningful pieces is a branded asset generator built into the site. Every social post, blog header, and shared image now comes out of the same generator with the same visual rules applied.

The reason this matters: per-channel manual asset tweaks were quietly drifting the brand across surfaces. The previous site's visuals would appear slightly differently on LinkedIn than on the docs site than on a GitHub social card, because each surface was being produced by hand. The generator removes that variation by enforcing the same rules at the source.

It also lowers the bar for contributors. Anyone in the collective who needs to produce a social image now uses the generator rather than asking the design-adjacent folks to produce one. That's a small thing in isolation; in aggregate it's the difference between a brand that's enforced by the people who have time to enforce it and a brand that's enforced by the codebase.

## Visual language

The new visual treatment is high-contrast and deliberately developer-terminal in feel:

- Black-and-white layouts with sharp edges. No rounded pastel blocks.
- Monospace detailing in section headers, badges, labels, and inline code-equivalents.
- An electric-blue accent reserved for interactive elements and emphasis.
- An animated ASCII-art backdrop on the homepage that nods to the kind of environment the collective's tools run in.
- Editorial typography replacing the previous display fonts.

The brief was simple: make the site look like what we actually ship. Our READMEs start with the canonical project tagline ("Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community") and lean on monospace detailing, plain typography, and clear structural hierarchy. The site now reads the same way.

## Under the hood

The codebase was tightened as part of the redesign. Entrance animations are subtler, the layout system is consolidated, the dependency footprint is smaller, and the build pipeline is faster. None of this is headline material on its own, but it removes the small drag that compounds over time.

## What this sets up

ContentForest has been live for a while and now has its own page on the site. The broader pattern (software whose primary job is to coordinate agents and surface their work to humans) is one the collective will keep shipping on. The new site is the place those announcements land.

Nothing else is promised here. The collective is volunteer-led today, and the explicit mission is to grow the contributor community and progressively decentralise. The site is one of the things that has to be in shape for that to work, and it's in better shape now. The next announcements will show up when the projects they're about are ready to be talked about, not before.

## How to read more

- The new site: [nanocollective.org](https://nanocollective.org)
- The brand guidelines (the rules the new site now reflects): [docs.nanocollective.org/collective/organisation/brand](https://docs.nanocollective.org/collective/organisation/brand)
- The organisation overview (how the collective is structured and funded): [docs.nanocollective.org/collective/organisation](https://docs.nanocollective.org/collective/organisation)
- The projects page (the full list and how projects come to life): [docs.nanocollective.org/collective/projects](https://docs.nanocollective.org/collective/projects)

If something on the new site reads as off-message, that's a bug. Open an issue on the docs repo and we'll iterate. The guidelines are versioned and meant to be updated when the brand shifts.