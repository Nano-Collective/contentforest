---
kind: personal
member: ben-parry
channel: linkedin-newsletter
slug: new-website-launch
generated_at: "2026-06-28T20:34:30.900Z"
model: "minimax-m3"
char_count: 5333
---

# The website is downstream of the architecture

We rebuilt the Nano Collective website this week. Most of the response has been about the visuals, which is fine. The visuals are noticeable. But the visuals are not the story. The story is what the rebuild revealed about how the collective was actually working.

I want to walk through what we changed, why we changed it, and what it tells me about the next round of things we are shipping.

## The starting point

The Nano Collective has held itself to three principles for as long as it has existed: privacy-respecting, local-first, open for all. They appear in that order in our brand guidelines. They appear in that order because that is the order in which we make decisions.

The previous website did not reflect any of that. It was soft, colourful, and pleasant to look at. It was the kind of site a marketing-led team would build when they want to be liked. The principles were on the page, but they were halfway down, framed as values. Values are decorative. Principles are filters. The previous site did not know the difference.

So the rebuild was not really about a redesign. It was about removing drift between what the collective says it is and what the collective actually does. The website is downstream of that.

## What we shipped

Three structural changes, plus a small pile of substance that matters mostly because of what it signals.

**1. Principles lead the homepage, in the order they appear in the brand guidelines.** Not as values. As the filter. Visitors land on the page and read privacy-respecting, local-first, open for all, in that order, before they read anything else we ship. That is the order in which decisions happen inside the collective, so it is the order in which decisions should be visible from the outside.

**2. Flagship projects get landing pages.** Nanocoder and Nanotune each have their own page now. Before, they were sharing a single paragraph on the projects index. That was fine when there were two projects. It stopped being fine when there were four. The full project list (Nanocoder, Nanotune, get-md, json-up) now lives on its own page, alphabetised as the brand guidelines ask, because the brand guidelines are the source of truth and the alphabetisation is not a stylistic preference.

**3. Live community proof instead of curated screenshots.** GitHub stars, Discord members, Reddit subscribers, and a feed of the latest discussions are now on the homepage, updating in real time. There is also a public growth page that publishes the same data over time, so the trajectory is visible to anyone who wants to look. We also shipped a public analytics page for our own site traffic, treated the same way we treat everything else we build: open and inspectable.

Under the hood there is a leaner codebase, entrance animations, a tightened layout system, and a branded asset generator that stops our social imagery drifting between surfaces. None of that is the story. The story is that the site finally stopped lying about what we are.

## Why the architecture looks the way it does

A website is a surface. Surfaces are honest when they are downstream of something real. Ours was not. It was upstream of a kind of generic startup-speak that the collective does not actually operate inside.

The fix was not stylistic. It was structural. We took the principles out of the marketing layer and put them into the information architecture. We took the project list out of the footer and gave each project a landing page. We took the community stats out of a slide deck and put them on the page, updating live.

When you build that way, the visuals follow. Black and white because the tools we ship are not decorative. Monospace because the people we build for live in terminals. Sharp edges because the project is honest about what it is. The animated ASCII-art backdrop on the homepage is a wink to the environment our tools actually run in. It is not branding. It is provenance.

## The broader principle

A website is downstream of an architecture. When the architecture is sound, the website tends to be honest. When the architecture is decorative, the website is decorative too. This applies well beyond websites. It applies to product surfaces, to how a team communicates, to how an organisation is run.

Most organisations design the surface first and try to retrofit the principles later. The principles end up on a poster in the office. The site says something else. Visitors are expected to infer the values from the colour palette.

We did it the other way around. The principles were already there. The site caught up.

## What is next

The website is the foundation for what we are about to ship next. ContentForest has its own page now. The whitepapers (Sentinel, the Private Inference Proxy, the Prompt Scrubber, the Marketplace, the Nano OS, the Docs Forest) each get their own space. The patterns of software that coordinate agents and surface their work to humans are something we will keep shipping on, and the site needs to be ready for it.

The trajectory is the interesting part. Each of these moves is small on its own. Together they describe a collective that is building infrastructure for AI that does not require you to trust the people running it. That is the work.

More soon.

https://nanocollective.org