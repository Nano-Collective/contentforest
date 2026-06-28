<!-- angle: "When the page becomes the principle" - the Nano Collective's website relaunch is treated as proof, not subject. The essay argues that an organisation's most honest marketing is the architecture it ships, and that drift happens the moment the page can disagree with the codebase. -->

---
kind: personal
member: ben-parry
channel: substack
slug: new-website-launch
generated_at: "2026-06-28T19:51:18.455Z"
model: "minimax-m3"
char_count: 13913
---

## Summary

Most websites argue for the organisation that built them. They open with what the company believes, then slowly back-fill the proof, and the reader is left to take the beliefs on trust. There is another way to do this. The site can be the proof. When the architecture enforces the principle, the page just points at it. This essay is about why that distinction matters more than the visual redesign, and why the organisations that get this right tend to be the ones whose code and copy have stopped drifting apart.

## Executive summary

- A page that opens with a principle is a values statement. A page where the architecture enforces that principle is a structural claim. The difference is auditable.
- Drift between what an organisation says and what it ships happens the moment two teams are paid to optimise for different things. The only durable fix is to put the principle in the codebase, not in the brand book.
- When the codebase enforces the brand, the page becomes a routing layer for proof rather than a curated performance of identity. That is a healthier organisation than the alternative, even when the alternative looks more polished.

## Key points

- The new Nano Collective site leads with three principles, then makes the projects visible as the consequence of those principles. The order is not decorative.
- Drift between brand and architecture is an incentives problem, not a discipline problem. You do not fix it with memos.
- Live data on the homepage (GitHub, Discord, Reddit stats) is harder to misrepresent than curated screenshots, for the same reason an open ledger is harder to cook than a press release.
- A branded asset generator inside the codebase removes the per-channel manual tweaks that quietly produce brand inconsistency across surfaces.
- When the site reflects what the README already says, contributors stop having to translate between contexts. That lowers the bar to participation in a way a slogan never will.
- Organisations that look like what they build attract the kind of contributors who want to keep building that thing. The page is a filter, even when it doesn't think of itself as one.
- A polished page that disagrees with the codebase is a tax on trust. Every visitor pays it. Most pay it silently.
- The argument has limits. Not every organisation has a codebase to point at, and not every principle can be enforced at the architecture layer. The principle is what to reach for, not what to demand of everyone.

## Cold-open hook

The cheapest test of whether an organisation believes its own homepage is to open the network panel and count the third-party domains. If the site claims privacy as a principle and the asset pipeline leaks browser fingerprints to a half-dozen ad networks, the principle is decoration. It is also a tax. Every visitor pays it, most of them silently, and almost none of them will name what they are paying for. They just leave with a slightly worse feeling about a brand they cannot quite place.

I have spent enough time building tools that respect the people who run them to find this depressing in a particular way. The depressing part is not that organisations do this. Most do, because the incentives reward it. The depressing part is that we have collectively stopped noticing it. The page has become a performance of identity, and the codebase has become the place where the identity actually lives, and the two are allowed to disagree with each other in peace.

This is a short essay about why that disagreement is more expensive than it looks, and about what changes when an organisation decides it cannot afford the disagreement anymore.

## Founder thesis

I think the most honest thing an organisation can do online is to make the page a routing layer for proof rather than a curated performance of identity. The page should not be where the principle lives. The codebase should be where the principle lives. The page should point at the codebase and get out of the way.

The reason this matters is not aesthetic. It is structural. A page is what the marketing team writes. A codebase is what the engineering team maintains. When those two are separate jobs, they are paid to optimise for different things. The marketing team is paid to express identity. The engineering team is paid to ship behaviour. The two diverge the moment a question of taste arises, and they diverge faster the larger the organisation gets.

The drift is not a failure of discipline. It is the predicted output of the system. You do not fix it by asking harder. You fix it by putting the principle somewhere both teams have to honour. The codebase is the only place that meets that bar, because the codebase is the only place that has to run.

## Core argument: principles in the codebase

The Nano Collective relaunched its website recently. I am not going to spend this essay describing the redesign, because the redesign is not the point. The point is what the redesign was an attempt to remove.

The previous site was soft and colourful. It read like a marketing site for an organisation that wanted to be approached, not like a documentation site for an organisation that wanted to be useful. That is a real difference. The READMEs the collective ships start with a canonical tagline, lean on monospace detailing, and treat the reader as someone who is here to read, not to be sold to. The site disagreed with the READMEs for a long time, and the disagreement was an open tax on the collective's credibility with the people it most wanted to reach.

The new site closes that gap. The principles lead the page. The flagship projects get the same landing treatment as their READMEs would get. The community section is no longer a curated screenshot of activity. It is live GitHub, Discord, and Reddit stats, updated continuously, with the same data plotted over time on a public growth page. There is a public analytics page so the collective's own site traffic is treated the same way its projects are treated: visible to anyone who wants to look.

None of this is dramatic on its own. What is dramatic is that the page now does what the codebase already does. The principle has migrated from the brand book to the architecture, and the page is just pointing at it.

That is the test I am interested in. Not whether the site looks good. Whether the site can be audited.

## Core argument: drift is an incentives problem

The reason most organisations cannot make this move is that it costs them something they have come to depend on. A marketing site is allowed to be aspirational. It is allowed to use the language of the category rather than the language of the actual product. It is allowed to promise a future that the roadmap does not yet contain, because the discipline of the codebase is somewhere else.

This is not a critique. It is a description of the system. The marketing site and the engineering site serve different audiences, and the audiences have different tolerances for ambiguity. The marketing audience wants to feel they are in the right place. The engineering audience wants to know whether the tool will run on their hardware. These are not the same question, and it is rational to answer them in different registers.

The cost is that the organisation now has two truths. One in the page, one in the repo. The reader has to guess which one they are looking at. Most of them guess wrong, and most of them guess wrong in the direction that benefits the organisation in the short term and costs it in the long term.

The fix is not to make the marketing site more honest. The fix is to make the marketing site unnecessary, by putting the principle in the codebase where it cannot be paraphrased away. Once the principle is enforced at the architecture layer, the page has nothing to disagree with. It either points at the architecture or it lies. There is no longer a third option, and that is what makes the move durable.

## The dual argument: idealism and its limits

I want to be honest about what this argument does and does not cover.

It covers organisations that have a codebase to point at. A privacy-respecting AI collective has a codebase. A local-first tooling group has a codebase. A small community-led organisation that ships open-source software has a codebase. For these organisations, putting the principle in the architecture is a real option. The work is hard, but the work is in scope.

It does not cover organisations whose principle is not enforceable at the architecture layer. A charity whose principle is compassion does not have a codebase that can enforce compassion. A movement whose principle is solidarity does not have a codebase that can enforce solidarity. For these, the page is the only place the principle can live, and the gap between the page and the behaviour is the gap the organisation has to manage by other means. This essay is not a recipe for them.

It also does not cover organisations that have decided they would rather have two truths than one. Some have. The short-term upside of being able to say one thing in the page and ship another in the codebase is real, and the cost is paid by the reader, who is the only party in the transaction without a budget to absorb it. This essay is not going to convince those organisations to change, and I am okay with that.

What I am interested in is the middle case. The organisation that would prefer to be honest, that cannot quite figure out how to be honest without losing something, and that is willing to look at the cost of the dishonesty honestly. That is the audience this argument is for.

## Evolution arc: how the drift happens

I have watched this drift happen in enough organisations to feel confident describing the trajectory.

Stage one is a small organisation that ships a product and writes a website that describes it. The website and the codebase agree, because they are written by the same person, often in the same week. The principle is implicit because there is no gap between the principle and the work.

Stage two is the organisation growing. The website starts to be written by someone who is not the engineer. The website starts to use the language of the category, because that is what the category responds to. The engineer notices and either does not care or cannot afford to care. The website drifts.

Stage three is the organisation hiring a marketing function. The marketing function is paid to express identity, and the engineering function is paid to ship behaviour. The two are paid to optimise for different things. The drift accelerates, and the gap becomes invisible to both teams, because each team is succeeding at its own job.

Stage four is the organisation wondering why the page and the codebase feel like they are about different organisations. The organisation usually responds with a brand refresh. The brand refresh closes the gap for six months and then the gap opens again, because the gap was never about brand. The gap was about incentives.

The fix is to put the principle in the architecture. That is a structural move. It is not a brand move. It is the move you make when you have stopped trusting the brand to do the work the architecture should have been doing all along.

## Founder stance: what this means in practice

I think about this from the inside because I am one of the people building the collective. We relaunched the site because the old site was no longer pointing at the work. The work had moved on. The site had not. The cost of that disagreement was being paid by the contributors who had to translate between contexts, by the readers who had to guess which version of the organisation they were looking at, and by the people we wanted to attract, who would have bounced the moment they realised the site disagreed with the codebase.

The new site is an attempt to remove that tax. It is not finished. There will be more drift to correct. The principles will move, and the page will have to move with them, and the architecture will have to move with the principles, and the work of keeping them in alignment is ongoing. That is the work. There is no version of this where the alignment is permanent, and there is no version of this where the work stops.

What I have come to believe is that this work is the work. Not shipping the tools, although that is also the work. Not writing the essays, although that is also the work. The work of keeping the page and the codebase in the same sentence. The work of making sure that when someone audits us, what they find is the same thing whether they start from the homepage or from the repo.

That is the only version of credibility I have learned to trust.

## Closing argument

The most honest marketing is the marketing you do not have to do. The most honest page is the page that points at the work. The most honest brand is the brand the codebase is already enforcing.

If you are running an organisation and your page disagrees with your codebase, that is a tax on trust. Your visitors are paying it. Most of them will not name it. They will just feel that something is slightly off, and they will leave slightly earlier than they would have, and you will not know why.

The fix is not a brand refresh. The fix is to put the principle in the architecture. The page will follow.

The collective's site is at [nanocollective.org](https://nanocollective.org). I write about what we are building and why at Mind & Machine.
