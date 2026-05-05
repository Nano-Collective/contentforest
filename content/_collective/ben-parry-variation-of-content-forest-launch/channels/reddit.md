---
kind: collective
slug: ben-parry-variation-of-content-forest-launch
channel: reddit
generated_at: "2026-05-05T09:56:38.382Z"
model: "minimax-m2.7"
char_count: 1770
---

The Nano Collective shipped a tool called ContentForest that automates release content generation across their product stack. I wanted to write this up because the architecture is more interesting than it sounds.

The tl;dr: a daily GitHub Action detects releases in their product repos (Nanocoder, Nanotune, get-md, json-up), runs a two-agent Nanocoder pipeline that drafts channel posts against their brand voice, validates the output, and commits it to git as markdown files. A human reads the output the next morning and ships it to whatever channels they're using.

The two things worth noting:

**Git is the database. There is no CMS.**

This isn't a gimmick. The content was already version-controlled, the team already works in git, and a PR review flow already exists for everything else they ship. Adding a database and an admin panel would have been friction for no gain. Sometimes the boring choice is the right one.

**Agents handle the writing; software handles orchestration; humans handle judgment.**

The generation pipeline runs overnight. The agent drafts the posts. The software validates and commits. The human reads the output, makes the judgment calls, and ships. This is deliberately different from how most teams handle this — which is "someone remembers to do it manually and it needs rewriting every time."

This is the collective's first shipped tool along the "software coordinates agents, humans get useful outputs" pattern. Worth watching if you're interested in what that shape looks like when it's actually shipped rather than just theorised about.

The Nano Collective is a community-led group building open AI tooling — local-first, privacy-respecting, open for all. No investors, no equity, no single owner. https://nanocollective.org