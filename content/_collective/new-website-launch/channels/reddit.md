---
kind: collective
slug: new-website-launch
channel: reddit
generated_at: "2026-06-27T21:04:36.123Z"
model: "minimax-m3"
char_count: 5026
distributed_at: "2026-07-08T13:13:05.184Z"
---

**TL;DR:** We rebuilt the Nano Collective website. The redesign is less about the new visuals and more about the site finally matching the brand guidelines we already had. The three principles lead the homepage, flagship projects get real landing pages, and community stats are live rather than curated.

---

A bit of context. We're the [Nano Collective](https://nanocollective.org), a small community-led group of developers, designers, and maintainers building open-source AI tooling not for profit, but for the community. Everything is [fiscally hosted by the Open Source Collective](https://opencollective.com/nano-collective) and published transparently. We have four shipped projects under the umbrella right now: [Nanocoder](https://github.com/Nano-Collective/nanocoder) (a terminal coding agent), [Nanotune](https://github.com/Nano-Collective/nanotune) (fine-tuning tooling for small local models), [get-md](https://github.com/Nano-Collective/get-md) (HTML to Markdown converter), and [json-up](https://github.com/Nano-Collective/json-up) (type-safe JSON migrations). We also have a number of whitepapers in the [docs site](https://docs.nanocollective.org) covering longer-term ideas (Sentinel, the Private Inference Proxy, the Prompt Scrubber, the Marketplace, the Nano OS, and the Docs Forest).

The old site was fine. It was soft, colourful, and pleasant to look at. The problem was that it didn't read like what we actually ship. Our README files start with the canonical project tagline ("Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community") and lean on monospace detailing, plain typography, and clear structural hierarchy. The old site didn't carry any of that.

## What changed in the design

The new visual treatment is high-contrast and deliberately developer-terminal in feel:

- Black-and-white layouts, sharp edges, no rounded pastel blocks.
- Monospace detailing in section headers, badges, and labels.
- An electric-blue accent reserved for interactive elements and emphasis.
- An animated ASCII-art backdrop on the homepage that nods to the kind of environment our tools actually run in.

Editorial typography replaced the previous display fonts. The effect is a site that reads like internal engineering documentation, closer to our READMEs and release notes than to a marketing page.

## What changed in the information architecture

The three principles (Privacy First, Open Source, Local First) now lead the homepage in the order they appear in the [Brand Guidelines](https://docs.nanocollective.org/collective/organisation/brand). The previous version had them further down, framed as values rather than as the filter they actually are.

Nanocoder and Nanotune each got a dedicated landing page. The full project list moved to a structured projects page, alphabetised, with one paragraph per project and a link to each repo. get-md and json-up are also on the page; flagging them matters because they often get overlooked in copy that leads with the AI-shaped projects.

## What changed in proof

The old site had a "community" section that was a curated screenshot of activity. The new site has:

- **Live GitHub, Discord, and Reddit stats** on the homepage, updated in real time.
- **A public growth page** that plots the same data over time, so the trajectory is visible.
- **A feed of the latest discussions** surfaced directly from the relevant channels.
- **A public analytics page** so traffic to the collective's own site is treated the same way we treat our own work: open and inspectable.

## What changed in the day-to-day

There's a branded asset generator now. Every social post, blog header, and shared image can come out of the same generator with the same visual rules applied. That's a small thing in isolation, but it ends the per-channel manual tweaks that were quietly drifting the brand across surfaces.

Behind the scenes the codebase was tightened. Entrance animations are subtler, the layout system is consolidated, and the dependency footprint is smaller. Nothing flashy, just less to maintain.

## What this site is for next

The redesign creates room for the next round of announcements. ContentForest has been live for a while and has its own page; the broader pattern of software that coordinates agents and surfaces their work to humans is one we'll keep shipping on. The new site is the place those announcements land.

Nothing else to promise. The collective is volunteer-led today and our explicit mission is to grow the contributor community and progressively decentralise. The site is one of the things that has to be in shape for that to work, and it's in better shape now.

If any of this lands (the principles-first ordering, the live stats instead of curated ones, the asset generator removing manual drift), come find us at https://nanocollective.org. The codebase for the site is public, the [docs](https://docs.nanocollective.org) are public, and the contributor channels are linked from both.