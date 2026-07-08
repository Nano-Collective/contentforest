---
title: ContentForest — Adding a Product
status: live
owner: Will Lamerton
---

# Adding a Product

Step-by-step for onboarding a new Nano Collective product into ContentForest's release-content pipeline. Operator-facing version of `planning.md` §7.2.

## Prerequisites

Before opening a ContentForest PR, the new product needs to exist independently as a real NC project:

1. **Product repo lives under [`Nano-Collective`](https://github.com/Nano-Collective)** and follows the conventions in [`Creating a New Project`](https://docs.nanocollective.org/collective/creating-a-new-project) (README, LICENSE, MIT, etc.).
2. **At least one tagged GitHub Release** is published. The release body is what ContentForest's agent reads to generate the announcement, so an empty release body produces a thin pack — give it real content.
3. **Product page on the docs site** at `https://docs.nanocollective.org/<slug>/`. The markdown source (`<slug>/index.md` in [`Nano-Collective/docs`](https://github.com/Nano-Collective/docs)) needs to be referenced from `llms.txt` so `scripts/fetch-refs.ts` pulls it into `_refs/<slug>/docs/` at generation time. The agent uses this as the elevator-pitch / brand-accuracy anchor (planning §6.4.1).

The product slug used everywhere — config, content directory, GH repo name, docs URL — should be **the same string** (lowercase, hyphenated). The four current products use slugs `nanocoder`, `nanotune`, `get-md`, `json-up` — note `nanocoder` is one word with no hyphen even though the local folder name `nano-coder` differs.

## Add the product to ContentForest

1. **Edit `config/products.json`** — append an entry:

   ```json
   {
     "slug": "<new-product>",
     "repo": "Nano-Collective/<new-product>"
   }
   ```

   The `repo` field is the full `owner/name` shape used by `gh` and `git clone`. Double-check the actual GH repo name (`gh repo list Nano-Collective` if unsure) — slugs and repo names usually match but historically have not (e.g. `nanocoder` vs the local `nano-coder` folder).

2. **(Optional) Override the channel set** — if the new product wants a different channel mix than the global default in `config/channels.json`, add a `channels` field to the product entry:

   ```json
   {
     "slug": "<new-product>",
     "repo": "Nano-Collective/<new-product>",
     "channels": ["linkedin", "github-discussion"]
   }
   ```

   Most products won't need this — the default (LinkedIn, X, GitHub Discussion, Reddit) is the right call for general-audience product releases.

3. **Open a PR.** Standard review, merge. The issue-template product dropdowns are auto-synced — the `sync-release-products` workflow fires on push to `main` touching `config/products.json` and opens a follow-up PR to add the new slug to `.github/ISSUE_TEMPLATE/release-request.yml`. No hand-editing required; just merge the follow-up PR when it lands.

## Backfill the most recent release

Release packs are generated on demand, so once the product is merged (and the dropdown-sync PR has landed), produce the first pack by filing a request:

1. Open a **[Request New Release Content](https://github.com/Nano-Collective/contentforest/issues/new?template=release-request.yml)** issue.
2. Set **Product** to the new slug and **Version** to the latest tag (without the `v` prefix).
3. Review the resulting PR.

If the latest release body is thin (e.g. a docs-only patch), expect zero articles and short channel posts — that's correct behaviour, not a failure (planning §6.6 / handoff `Don'ts`).

## What the new product gets

Once added, the new product has:

- Release packs generated on demand by filing a **Request New Release Content** issue.
- One PR per release pack at `content/<new-product>/<version>/`, validated automatically.
- Visibility on the file viewer at `https://contentforest.nanocollective.org/p/<new-product>/`.
- The same brand voice + channel rules as every other NC product.

It does **not** automatically get:

- Posting to social channels (out of scope, planning §14 — every post is copy-pasted by a human).
- Custom personal-account variants per team member (the personal-variant pipeline was removed on 2026-05-01 — see `implementation.md` decision log).
- A separate visual identity in the file viewer (the homepage product grid lists every product the same way).

## Sanity checks before merging

- [ ] `pnpm types` and `pnpm lint` clean (the `config/products.json` edit is plain JSON; nothing to break, but the gates run anyway).
- [ ] `pnpm detect-releases` (manual diagnostic) shows the new product's latest release as unprocessed.
- [ ] `pnpm generate --product <new-product> --version <v> --dry-run` substitutes cleanly — no `{{...}}` placeholders left in the prompt body.
- [ ] (Optional but recommended) `pnpm fetch-refs && pnpm generate --product <new-product> --version <v> --test` produces a sensible pack locally before you file the first release request.
