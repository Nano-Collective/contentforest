---
title: ContentForest — Planning
status: draft v3 — round-2 questions resolved 2026-04-30
owner: Will Lamerton
last_updated: 2026-04-30
---

# ContentForest — Planning

## 1. Vision

ContentForest is the Nano Collective's content cockpit. It is a private, members-only Next.js application living at `contentforest.nanocollective.org` that:

1. Runs a daily GitHub Action checking every Nano Collective product repo for new releases.
2. When a release is detected, generates a full release content pack — a release announcement plus up to ten social posts split across our channels and personal-account variants — using **Nanocoder in non-interactive mode** orchestrated by a dedicated content sub-agent.
3. Commits the generated markdown back into this repo under a known structure.
4. Renders that markdown through a file-viewer-style web UI where authorised core team members can browse, copy, and download content for posting.

The whole system is intentionally **stateless and database-free**. Persistence is git, auth is GitHub org membership, and the only "backend" is a scheduled action.

## 2. Constraints and Principles

- **No database.** All state lives in this repo (markdown + JSON metadata) or in GitHub itself (releases, org membership).
- **Static-first hosting.** ContentForest is a Next.js static export deployed to **Cloudflare Pages**, the same way the website is deployed. No SSR, no Node runtime in production.
- **Auth at the edge.** A **Cloudflare Access** policy in front of Pages requires GitHub identity and `Nano-Collective` org membership before any asset is served. The Next.js app itself contains no auth code.
- **Read-only web.** The web app is a viewer for content already committed to git. It does not write back. Posting to channels happens manually outside ContentForest, by humans copying content out.
- **Brand voice over volume.** Every generated piece must pass the brand guardrails in `../docs/content/collective/organisation/brand.md` — operational, understated, honest, no marketing register, no forbidden terms.
- **Technical accuracy is non-negotiable.** Generated content must not invent features. The generator reads the actual changelog, release notes, and where useful the source repo.
- **Match the existing site.** Reuse the Next.js website's stack, theme, fonts, components, and UI feel so ContentForest looks like a member of the family.
- **PR-gated content.** Every generated release pack lands as a PR; merging the PR *is* the readiness signal. There is no separate `ready` toggle.
- **One-way replacement.** Once ContentForest is shipping content reliably, we delete the existing `generate-release-content.yml` workflow in `nano-coder`.

## 3. Architecture (high level)

```
                                    ┌───────────────────────────────────────┐
                                    │  ContentForest repo (this repo)       │
                                    │                                       │
   GitHub releases ─────────────────▶  .github/workflows/daily-content.yml  │
   across NC org                    │   ├─ detect-releases.ts               │
                                    │   ├─ generate-content.ts              │
                                    │   │   (invokes `nanocoder run …`)     │
                                    │   └─ opens PR per release pack        │
                                    │        │                              │
                                    │        ▼                              │
                                    │  content/<product>/<version>/         │
                                    │     release.md, channels/*, …         │
                                    │        │                              │
                                    │        ▼  (PR merged to main)         │
                                    │  Cloudflare Pages build               │
                                    │   - next build (output: "export")     │
                                    │   - statically renders all content    │
                                    └────────────────────┬──────────────────┘
                                                         │
                            ┌────────────────────────────▼─────────────────────────────┐
                            │  Cloudflare Access policy on contentforest.nanocollective │
                            │  IdP: GitHub      Rule: member of Nano-Collective org     │
                            └────────────────────────────┬─────────────────────────────┘
                                                         │
                                                         ▼
                                                core team browser
```

The web app is a Next.js 15 (Pages Router) app, **statically exported** to Cloudflare Pages on every push to `main`. It contains zero server code: no API routes, no middleware, no SSR. Auth is enforced by Cloudflare Access at the edge — unauthorised requests never reach a static asset. Content is read from the filesystem at build time via `getStaticProps` / `getStaticPaths`.

## 4. Tech Stack — Mirror the Website

The Nano Collective website (`../website`) is the source of truth for stack decisions. We will copy its choices wherever sensible.

| Concern             | Decision                                                                                       |
|---------------------|------------------------------------------------------------------------------------------------|
| Framework           | Next.js 15.x, **Pages Router**                                                                 |
| Language            | TypeScript                                                                                     |
| Package manager     | pnpm                                                                                           |
| Styling             | Tailwind CSS 4 via PostCSS, CSS variables (Tokyo Night theme), no `tailwind.config.js`         |
| Fonts               | Poppins / Lora / Fira Code (Google Fonts)                                                      |
| UI primitives       | Radix UI + the website's `components/ui/` shadcn-style wrappers (copy verbatim, then evolve)   |
| Icons               | `lucide-react`, `react-icons`                                                                  |
| Markdown rendering  | `marked` (matches website's blog renderer + `.prose` styles in `globals.css`)                  |
| Linter / formatter  | Biome (with website's `biome.json` as starting point)                                          |
| Build               | Turbopack                                                                                      |

**No divergence from the website.** ContentForest also uses `output: "export"` and deploys to Cloudflare Pages. Auth is handled outside the app by Cloudflare Access, so we don't need SSR, middleware, or API routes.

## 5. Auth — Cloudflare Access in front of Cloudflare Pages

The Next.js app contains no auth code. All auth is enforced at the edge:

- **Cloudflare Zero Trust → Access application** scoped to `contentforest.nanocollective.org`.
- **Identity provider:** GitHub, configured at the Cloudflare Zero Trust account level.
- **Policy:** require GitHub identity AND `github_organization` claim contains `Nano-Collective`. Unauthorised users hit the Cloudflare Access login screen and never reach a static asset.
- **Session lifetime:** 24h (Cloudflare default), reauth on expiry. Re-verification of membership happens at every login because the GitHub IdP returns the user's orgs each time.
- **Logout:** standard Cloudflare Access logout URL (`/cdn-cgi/access/logout`) — exposed as a "Sign out" link in the Navbar.
- **Failure mode — user removed from org:** their next session refresh fails because GitHub no longer returns `Nano-Collective` in their orgs claim; they are kicked out automatically within the session window.

**Why this beats NextAuth here:** with a static export there is no server in the response path, so any in-app auth would be client-side only and trivially bypassed (anyone could read the bundled HTML/JSON for `/p/<product>/<version>` directly). Cloudflare Access blocks the request at the edge before any asset is served, so static + private actually composes correctly.

**Public org caveat:** `Nano-Collective` is a public organisation, which is what we need — Cloudflare Access reads org membership from the GitHub OAuth response and a public org returns it without extra setup. No org-admin toggles or org-internal SAML to wire up.

## 6. Content Generation Pipeline

### 6.1 Trigger

`.github/workflows/daily-content.yml` runs on `schedule: '0 8 * * *'` (08:00 UTC) and on `workflow_dispatch` for manual reruns.

### 6.2 Release detection

`scripts/detect-releases.ts` enumerates the Nano Collective repos we care about (configured in `config/products.json` — see §7) and for each one:

1. Calls `gh api repos/Nano-Collective/<repo>/releases` and gets the latest release.
2. Compares against `content/<product>/index.json` which records the highest version we've already processed.
3. If a new release is found, emits a job spec `{ product, version, releaseUrl, body, sha, publishedAt }` for the generator.

Multiple new releases in one run are processed sequentially.

### 6.3 Generation

`scripts/generate-content.ts` invokes the Nanocoder CLI in non-interactive mode for each job. Provider and model are **not hard-coded** — they're read from `agents.config.json` (committed) so swapping models is a config change, not a code change. Initial provider plan is **MiniMax M2.7** (configured by you).

```bash
nanocoder --mode auto-accept run "$(cat prompts/release-pack.md)"
```

Notes:

- The prompt file is templated with the job spec (product, version, release body, link to the source repo cloned during the action).
- We clone the **target product repo** into the workspace so Nanocoder can read its actual `CHANGELOG.md`, `README.md`, source files, and brand-relevant references for technical accuracy.
- We also have the **docs repo** available (mounted/cloned) so the prompt instructs Nanocoder to consult `collective/organisation/brand.md` — this is how brand-voice enforcement is wired in.
- Output is captured by Nanocoder writing files directly via its `Write` tool into `content/<product>/<version>/...`. We do **not** rely on stdout redirection for the multi-file case — we instruct the agent to write each artifact to its target path.
- `--mode auto-accept` is appropriate; `yolo` is reserved for cases where bash steps are also auto-approved. We will start with `auto-accept` and escalate only if needed.
- **Cost** is managed at the provider level (you're on the coding plan), so there is no in-action job cap.

### 6.4 Sub-agent

We define a custom Nanocoder agent in `.nanocoder/agents/release-content-generator.md` (Nanocoder reads this from the working directory). The agent:

- Has read access to the cloned product repo and to brand/product reference material fetched at the start of the run (see §6.4.1).
- Has `Write` access scoped to `content/`.
- Carries the brand voice rules and forbidden-terms list inline (mirrored from the live docs as a belt-and-braces in case the fetch step fails).
- Carries per-channel rules (length, tone, hashtags, CTAs).
- Reads `config/team.json` and produces a personal-account variant for each opted-in member, using their per-channel `voice_notes` example.

### 6.4.1 Reference material the agent reads

At the top of every generation run, the workflow fetches reference material **from the live docs site** and materialises it locally so the agent reads from disk, not from the network.

The discovery layer is `https://docs.nanocollective.org/llms.txt` — a contents listing of every relevant doc on the site, designed for LLM consumption. `scripts/fetch-refs.ts`:

1. Fetches `llms.txt` and saves it to `_refs/llms.txt`.
2. Parses every doc URL listed in it.
3. Fetches each referenced `.md` and saves it under `_refs/` preserving the path structure.
4. Fails the workflow loudly if `llms.txt` itself 404s, or if any individual doc returns a non-2xx (configurable: `--allow-partial` skips broken doc URLs and warns).

The agent's prompt then says:

> *Consult `_refs/llms.txt` for an index of available docs. Read whichever files under `_refs/` are relevant to the product `<product>` and the brand. The brand guidelines are at `_refs/collective/organisation/brand.md` (or wherever `llms.txt` points). All claims about product features must be grounded in either the cloned product repo or these docs — do not invent.*

This pattern means:
- One source of truth: the live docs site.
- Agent always sees the freshest brand and product docs (next daily run after a docs edit).
- All reads are local at agent time (reliable, fast, no HTTP at the inner loop).
- New products and new docs land in ContentForest automatically the next time `llms.txt` is updated — no code change needed.

This replaces an earlier draft idea of committing `config/product-blurbs/<slug>.md` files; we don't need them — `llms.txt` plus the docs site is canonical.

### 6.5 PR per release pack

After generation, the workflow:

1. Updates `content/<product>/index.json` with the new version.
2. Creates a branch `auto/release-<product>-<version>`, commits the generated files, and **opens a PR** (one PR per release pack).
3. The PR triggers `validate-content.yml` (CI checks, see §6.6). When checks are green a human reviews the diff and merges. **Merging is the readiness signal** — there is no separate `ready` flag.

### 6.6 PR checks

A second workflow `validate-content.yml` runs on every PR touching `content/**` and runs `scripts/validate-content.ts`:

**Hard rules (fail the check, block merge):**
- Frontmatter schema is correct (product, version, channel, generated_at, model, char_count).
- Every expected file exists (`release.md`, one per channel in `config/channels.json`, one per opted-in team member).
- X post is ≤ 280 chars; LinkedIn / Reddit / GitHub Discussion within configured ranges.
- No forbidden term from `_refs/brand.md` "forbidden" list — regex check on canonical phrases ("Sovereign AI", "Trustless AI", "Intimate Technology", "Intelligent Infrastructure").
- No `{{TODO}}`, `{{RELEASE_URL}}`, or other unresolved placeholder.
- Each post links to the **product GitHub repo root URL**, not a release URL (see §10).
- `meta.json` exists and is valid JSON.

**Soft rules (annotate the PR with a warning, do not block merge):**
- Marketing-register flagged terms ("transformative", "revolutionary", "game-changing", "unleash", "supercharge", etc.). The list lives in `scripts/validate-content.ts` and we tune it as we see what the model produces.

The validator emits a structured machine-readable report (`validation-report.json`) listing every failure with `{file, rule, expected, actual}`. This is what powers the auto-fix loop in §6.7.

### 6.7 Auto-fix loop on validation failure

**What "auto-fix" means here:** when validation fails, the agent is re-invoked with the structured error report as context and asked to fix *only* the listed issues. The fix lands as a new commit on the same branch (or, in Layer 1's case, as a re-write before the PR is even opened). The PR is then ready for normal human review with a working green status check. The human always merges; the agent never does.

The validator is enforcement; the agent is the remediation. Three layered defenses, **all shipped in Phase 2**:

**Layer 1 — Pre-PR retry inside `daily-content.yml`.**
After `nanocoder run` completes, the workflow runs the validator locally. If it fails, the workflow re-invokes Nanocoder with the prompt augmented by the structured error report:

> *Your previous attempt failed validation. Errors below. Fix only the listed issues; do not rewrite passing files.*
> ```json
> [{"file": "channels/x.md", "rule": "max_chars", "expected": "≤280", "actual": 304}]
> ```

Up to **3 retries**. If all 3 fail, the workflow still opens the PR but with a `failed-validation` label and a comment containing the final error report. From here Layer 3 takes over.

**Layer 2 — `validate-content.yml` PR check.**
Same validator, runs on every push to a PR (every commit, including the bot's own and any human edits). Catches anything that slipped through Layer 1 and anything a human breaks while editing. Failing blocks merge.

**Layer 3 — Auto-fix on PR check failure (deferred to Phase 3, conditional).**
A `auto-fix.yml` workflow that listens for `validate-content.yml` failures on `auto/*` branches, checks out the branch, re-invokes Nanocoder with the validation error report, and force-pushes a fix commit. Capped at 2 attempts via `auto-fix-attempts/N` PR labels; on the third failure the PR is labelled `needs-human` and the loop stops.

**Why deferred:** Layer 3 needs to push commits that re-trigger `validate-content.yml`. The default `GITHUB_TOKEN` is intentionally inert for that — pushes from the workflow token deliberately don't fire other workflows. The clean fixes are either a fine-grained PAT (`NC_BOT_TOKEN`) or a dedicated `nanocollective-bot` GitHub App. Both add operational overhead (token rotation or app installation) that we don't want to absorb up-front when Layer 1 likely catches most failures.

**Trigger to build it:** if more than 20% of release-pack PRs over the first month land with `failed-validation` because Layer 1's 3 retries weren't enough, build Layer 3 — and pair it with the `nanocollective-bot` GitHub App provisioning so we never need a PAT.

**Phase 2 ships Layers 1 + 2 only.** That's enough to test the contract end-to-end: the agent generates, the validator gates the PR, humans review and merge.

**Loop-guard design (recorded for whenever Layer 3 lands):**
- Hard cap of 2 Layer-3 attempts per PR (`auto-fix-attempts/0..2`).
- Skip Layer 3 if the PR has `needs-human` or if the most recent commit on the branch was by a human (committer email ≠ bot email).
- Workflow `timeout-minutes: 15`.
- Retries logged in `meta.json` (`generation_attempts`, `auto_fix_attempts`, `final_status`).

## 7. Content Structure

```
content/
  index.json                       # global manifest (products, last run timestamp)
  nanocoder/
    index.json                     # latest version, all known versions
    1.25.2/
      meta.json                    # { product, version, product_url, generated_at, model, ... }
      channels/
        linkedin.md
        x.md
        github-discussion.md       # canonical long-form: posts to GH Discussions on
                                   # Nano-Collective/website, which becomes the website blog post
        reddit.md                  # single Reddit post; team adapts per-subreddit manually
      personal/
        will/
          linkedin.md              # Will's LinkedIn variant
          x.md                     # Will's X variant
        <other-team-member>/
          ...
      sources/                     # what the agent read — for traceability
        changelog-excerpt.md
  nanotune/
    ...
  get-md/
    ...
  json-up/
    ...
```

Each markdown file uses a short YAML frontmatter:

```yaml
---
product: nanocoder
version: 1.25.2
channel: linkedin            # or "x", "reddit", "github-discussion", "personal:will:linkedin"
generated_at: 2026-04-30T08:13:22Z
model: minimax-m2.7
char_count: 412
---
```

There is **no `ready` flag** — merging the PR is the readiness signal. The web UI just renders what's in `main`.

### 7.1 Product registry

`config/products.json` is the registry of repos to watch. All products post to all channels (per the channel set in `config/channels.json`); team members opt in to personal variants per channel via `config/team.json`. The schema is intentionally minimal:

```json
[
  { "slug": "nanocoder", "repo": "Nano-Collective/nano-coder" },
  { "slug": "nanotune",  "repo": "Nano-Collective/nanotune"  },
  { "slug": "get-md",    "repo": "Nano-Collective/get-md"    },
  { "slug": "json-up",   "repo": "Nano-Collective/json-up"   }
]
```

### 7.2 Adding a new product

This procedure is documented for the team because we expect more products to land. Steps:

1. Create the product repo under `Nano-Collective` and ship at least one tagged GitHub release.
2. Publish a product page at `https://docs.nanocollective.org/<slug>/` so the markdown sibling at `https://docs.nanocollective.org/<slug>/index.md` exists. ContentForest fetches this every run as the elevator-pitch / brand-accuracy anchor (see §6.4.1).
3. Open a PR to ContentForest editing `config/products.json` to add the new entry.
4. (Optional) Override the channel set for this product in `config/products.json` by adding a `channels` field; otherwise the global default in `config/channels.json` applies.
5. Merge. The next daily run picks up the product. To backfill its most recent release immediately, manually trigger the workflow with `product=<slug>` and `version=<version>`.

A copy of these steps lives in `docs/adding-a-product.md` (to be written in Phase 3).

### 7.3 Channels registry

`config/channels.json` lists the channels and per-channel rules (length, tone hint, link style). Editing this file is how we add or change a channel for *every* product at once.

```json
[
  { "slug": "release",            "kind": "long-form",  "max_words": 600 },
  { "slug": "linkedin",           "kind": "social",     "min_words": 150, "max_words": 250 },
  { "slug": "x",                  "kind": "social",     "max_chars": 280 },
  { "slug": "github-discussion",  "kind": "long-form",  "min_words": 200, "max_words": 400 },
  { "slug": "reddit",             "kind": "social",     "min_words": 150, "max_words": 250 }
]
```

### 7.4 Team registry

`config/team.json` lists core team members who want personal-account variants and gives the generator their voice **per channel**, because the same person often writes differently on LinkedIn vs X. Schema:

```json
[
  {
    "name": "Will Lamerton",
    "channels": {
      "linkedin": {
        "handle": "william-lamerton",
        "voice_notes": "Plain, longer-form, technical first-person. Talks about *why* something was built. No hashtags. Example: '…'"
      },
      "x": {
        "handle": "@willlamerton",
        "voice_notes": "Short. One sentence per line. Drops in a code snippet or a number. No emoji, max one hashtag. Example: '…'"
      }
    }
  }
]
```

A member appears on a channel only if that channel key is present in their entry — opt-in by listing. Will populates this in Phase 1, importing voice rules from an existing repo.

This is also our agreed substitute for per-channel voice guidance at the collective level: the brand voice stays uniform across all official channels, and per-person tone for personal accounts lives here.

## 8. Web App — File Viewer UX

The web app is purely a read-only viewer. No write-back, no API routes, no auth code in the bundle.

- **Layout:** Same Navbar/Footer pattern as the website. No "Sign in" button (Cloudflare Access handles login before the page loads). The Navbar shows the user's GitHub identity (read from the `Cf-Access-Authenticated-User-Email` header surfaced via a tiny client fetch to a Cloudflare Pages-supplied JSON, or simply omitted) and a "Sign out" link pointing to `/cdn-cgi/access/logout`.
- **Home (`/`):** A grid of products with the latest release version.
- **Product (`/p/[product]`):** A list of versions, newest first.
- **Version (`/p/[product]/[version]`):** A two-pane file-viewer:
  - Left: tree of files (`release.md`, `channels/*`, `personal/*`).
  - Right: rendered markdown preview with a tab to flip to raw source. Buttons: **Copy** (clipboard) and **Download** (`<a download>` to the raw `.md`).
- **Search:** Out of scope for v1.
- **Rendering pipeline:** Pure static — `getStaticProps` reads the filesystem at build time; `getStaticPaths` enumerates products and versions from `content/`. Every PR merge triggers a Pages rebuild (~1–2 min) that regenerates the static site with the new content.

## 9. Brand & Technical-Accuracy Enforcement

The generator agent must be instructed to:

1. **Never** use any term in the brand doc's "forbidden" list ("Sovereign AI", "Trustless AI", "Intimate Technology", "Intelligent Infrastructure"), nor synonyms in marketing register.
2. **Always** include the canonical tagline on the long-form `github-discussion.md` where appropriate.
3. **Only** describe features that appear in the changelog or the actual source. The agent reads the repo; if it cannot ground a claim, it must omit it.
4. **Match channel rules** (see §10) including character limits and tone.
5. **Cite** internally — every `github-discussion.md` references the source GitHub release URL in the body where relevant (link target rule still requires the repo root URL too).

`scripts/validate-content.ts` enforces a subset mechanically (forbidden terms regex, X char limit, frontmatter shape). The rest is verified at human review.

## 10. Channels & Voice

Brand voice is uniform across all channels (operational, understated, honest — per `../docs` brand guidelines). Per-channel rules cover *length and shape*, not voice. Per-person flavour for personal accounts comes from `config/team.json` `voice_notes`.

| Channel              | Length          | Shape                                                                          | Link target                  |
|----------------------|-----------------|--------------------------------------------------------------------------------|------------------------------|
| GitHub Discussion    | 300–1500 words  | The canonical long-form release post. Engineering-doc register. Posted in `Nano-Collective/website` discussions, which renders as the website blog post. | Product GitHub repo root. |
| LinkedIn             | 150–250 words   | One CTA, no hashtag soup.                                                      | Product GitHub repo root.    |
| X                    | ≤ 280 chars     | One link, max two hashtags.                                                    | Product GitHub repo root.    |
| Reddit               | 150–600 words   | Single post; team adapts per-subreddit manually (r/nanocoder is the primary).  | Product GitHub repo root.    |
| Personal accounts    | 150–250 words   | First-person, flavoured by member's per-channel `voice_notes`.                 | Product GitHub repo root.    |

**Link policy:** every post links to the **product GitHub repo root URL** (e.g. `https://github.com/Nano-Collective/nano-coder`), never the release-specific URL. Validation (§6.6) enforces this.

There is no separate `release.md` — `github-discussion.md` IS the canonical long-form artifact. The website blog reads from GitHub Discussions on `Nano-Collective/website`, so this file is what becomes the public release blog post once a human pastes it into a new Discussion.

Up to ten outputs per release fits comfortably (4 channels + up to 6 personal variants ≤ 10).

## 11. "In-between" content

Beyond per-release packs, the brief calls for interesting standalone content per product to fill the gap between releases. **Confirmed in scope.**

Design: a second scheduled job (`weekly-content.yml`, default Monday 08:00 UTC) that, for each product, generates a **full content pack** — one post per channel plus per-team-member personal variants, same shape as a release pack — grounded in the repo's recent activity (commits, merged PRs, open discussions, README sections worth highlighting) since the last weekly run. We deliberately keep the structure identical to a release pack so the validator, the agent, the auto-fix loop, and the web viewer all work without branching logic.

Output lands in `content/<product>/_evergreen/<yyyy-mm-dd>/` and goes through the same PR-per-batch flow.

**Deferred to Phase 3** — release packs ship first so we can prove the agent + brand-enforcement loop on a smaller surface.

## 12. Phasing

**Phase 0 — Scaffold (now)**
- This planning doc (✅ v2 with answers).
- Confirm new open questions in §15.

**Phase 1 — Static web shell + Cloudflare deploy (week 1)**
- Next.js 15 + Pages Router scaffold with `output: "export"`.
- Copy `globals.css`, `components/ui/`, `Navbar`, `Footer`, `ThemeToggle` from `../website`. Rebrand the Navbar (title "ContentForest", same mark and colours).
- File viewer pages reading from a hand-written sample `content/nanocoder/0.0.0/` so the UI has something to render.
- Cloudflare Pages project pointed at this repo, `nanocollective.org` zone.
- Cloudflare Access policy on `contentforest.nanocollective.org` requiring GitHub IdP + `Nano-Collective` org membership.
- DNS cut.

**Phase 2 — Generation pipeline (week 2–3)**
- `config/products.json`, `config/channels.json`, `config/team.json`.
- `agents.config.json` with MiniMax M2.7 (provider key configured by you) as the default provider.
- `prompts/release-pack.md` — templated prompt.
- `prompts/auto-fix.md` — templated prompt for retry invocations (re-uses the original prompt plus the error report). Used by Layer 1 in Phase 2; reused by Layer 3 in Phase 3.
- `.nanocoder/agents/release-content-generator.md` — agent definition with brand voice rules and validation contract.
- `scripts/fetch-refs.ts`, `scripts/detect-releases.ts`, `scripts/generate-content.ts`, `scripts/validate-content.ts`.
- `scripts/generate.local.ts` — local entry point (see §12.1) that does the same thing the workflow does, no GitHub Actions required.
- `daily-content.yml` workflow (cron + `workflow_dispatch` with `product`/`version`/`dry_run` inputs).
- `validate-content.yml` workflow (PR check).
- Layers 1 + 2 of §6.7 (Layer 3 deferred to Phase 3).
- End-to-end test against a real Nanocoder release.

**Only secret needed in Phase 2: `MINIMAX_API_KEY`.** No PAT.

**Phase 2.5 — Testing strategy (within Phase 2)**
- `workflow_dispatch` inputs on `daily-content.yml`: `product` (required), `version` (required), `dry_run` (default false).
- When `dry_run=true`, the generator writes to `content/_test/<product>/<version>/` and the resulting PR is labelled `test` (CI passes but the team doesn't merge it; we close + delete the branch when done).
- **Backfill**: on launch, manually trigger one run per product (4 in total) for the most recent release of each so the team has live test data and the prompt gets early tuning.
- `scripts/seed-fixtures.ts` pulls the latest released version for each product into `content/_test/` so we have a stable corpus for prompt-tuning sessions.

**Phase 3 — Retire old action + weekly content + (conditionally) Layer 3**
- "In-between" weekly content job (`weekly-content.yml`).
- Delete `nano-coder/.github/workflows/generate-release-content.yml`.
- `docs/adding-a-product.md` — operator-facing version of §7.2.
- `docs/runbook.md` — what to do when a generation run fails, when a PR check fails, how to roll back a bad merge.
- **Conditional (gated on observed failure rate, see §6.7):** provision `nanocollective-bot` GitHub App and ship `auto-fix.yml` (Layer 3). Doing both together avoids ever introducing a PAT.

**Phase 4 — Out of scope**
- Posting integrations (one-click to LinkedIn / X / Reddit) — confirmed out of scope.
- Search.

## 12.1 Local generation

The same pipeline must run on a developer laptop without GitHub Actions, so prompt tuning is fast.

```bash
pnpm install
export MINIMAX_API_KEY=...
export NC_REPOS_DIR=~/Documents/GitHub/nano-collective    # optional; if set, skip cloning
pnpm generate -- --product nanocoder --version 1.25.2
```

`scripts/generate.local.ts` does what `daily-content.yml` does:

1. Calls `fetch-refs.ts` to populate `_refs/` from the live docs site (`llms.txt` + every doc it lists).
2. Resolves the target product repo. If `NC_REPOS_DIR` is set and `$NC_REPOS_DIR/<product>` exists, uses that checkout in-place; otherwise clones the repo into a temp dir for the run. This means contributors who don't already have the repos cloned still get a working `pnpm generate` with no setup beyond the API key.
3. Invokes Nanocoder with the same prompt and agent the workflow uses.
4. Runs the validator. On failure, runs the same Layer 1 retry loop (default 3 retries; override with `--max-retries`).
5. Writes output to `content/_local/<product>/<version>/` (gitignored). Pass `--commit` to write to `content/<product>/<version>/` for a real run.

This means: no GitHub Action needed to iterate on prompts, the agent definition, or the validator. The cron action is just `generate.local.ts` plus a PR-opening step.

## 13. Risks

- **Cloudflare Access lock-in:** auth is provided entirely by Cloudflare. If we ever moved off Cloudflare we'd need to add NextAuth + a Node runtime. Acceptable trade-off for the simplification it buys; we already host on Cloudflare.
- **Static site, content visible to logged-in members:** because the site is static, anyone who passes Cloudflare Access can see *all* content. There is no fine-grained ACL. This is fine — every team member should see every product's content. Worth noting if we ever onboard a non-core "viewer" role.
- **Nanocoder agent reliability in CI:** non-interactive runs that hit unexpected prompts will hang. We must use `--mode auto-accept` (or `yolo` if necessary) and set a workflow `timeout-minutes`.
- **Drift between website and ContentForest UI components:** if we copy the website's `components/ui/` we have two copies to maintain. Acceptable short-term; a shared package is over-engineering until there's a third consumer.
- **Brand-doc dependence at generation time:** the action needs the docs repo cloned alongside. Adds an extra checkout step but is cheap.
- **PR queue depth:** if a quiet week is followed by a burst of releases, we could open many PRs in one run. The `workflow_dispatch` `product`/`version` inputs let us throttle manually if needed; we'll watch for this in Phase 3 once the pipeline is live.

## 14. Decisions already made (recorded for posterity)

Confirmed in v1 of this doc:
- No database. Git is the database.
- Pages Router (not App Router) to mirror the website.
- Tailwind 4 with the website's globals.css verbatim.
- Nanocoder, not Claude Code Action, drives generation. The current `nano-coder` workflow is retired once we ship.

Confirmed via 2026-04-30 round 1 Q&A:
- **Hosting:** Cloudflare Pages, static export. Same pattern as the website.
- **Auth:** Cloudflare Access in front of Pages, GitHub IdP, `Nano-Collective` org-membership policy. No NextAuth.
- **Web app is read-only.** No commit-from-web. No "mark ready" toggle.
- **PR-gated content.** Every release pack lands as a PR; merging the PR is the readiness signal.
- **One `validate-content.yml` PR check** enforces brand and shape rules.
- **All products post to all channels** (uniform set in `config/channels.json`).
- **Single Reddit post per release**; team adapts per-subreddit manually.
- **Uniform brand voice across channels.** Per-person flavour for personal accounts lives in `config/team.json`.
- **Link target is product GitHub repo root**, never the release URL.
- **Provider/model:** MiniMax M2.7 (configured by user in `agents.config.json`). Cost managed at provider plan level — no in-action cap.
- **Posting is manual, always.** No posting integrations.
- **Visual identity:** reuse website's mark, colours, shadcn/Radix setup, fonts, and Tokyo Night theme. Title `ContentForest · Nano Collective`.
- **In-between weekly content is in scope.** Phase 3.

Confirmed via 2026-04-30 round 2 Q&A:
- **Cloudflare Zero Trust:** to be enabled by Will (admin); Pages project under the existing Nano Collective Cloudflare account; Access policy at the org-membership level (not core-team-only).
- **PR review:** humans-only merge, no auto-merge. Just Will reviewing initially; branch-protection rules imported from another repo.
- **Bot:** `github-actions[bot]` to start; aspirational `nanocollective-bot` GitHub App in Phase 3.
- **Provider key:** secret `MINIMAX_API_KEY`; `agents.config.json` references it.
- **Backfill:** one PR per product on launch, against the most recent release.
- **Cron times:** 08:00 UTC daily; weekly Mondays 08:00 UTC.
- **Weekly content:** full content pack per product (all channels + all opted-in personal variants), same shape as a release pack.
- **Team registry:** per-channel handles + per-channel voice notes (richer schema in §7.4).
- **Brand and product references:** fetched from `https://docs.nanocollective.org/llms.txt` at run time and materialised under `_refs/` for the agent to read. The docs site is canonical; no `config/product-blurbs/` directory.
- **GH Discussion category:** poster's call, not encoded.
- **Soft forbidden-terms list:** yes, warning-only, alongside the hard list.
- **Failure notifications:** native GitHub Action failures only; team has notifications on.
- **Stale PR sweep:** out of scope for now.

New in v3 (then revised after round-3 Q&A):
- **Auto-fix loop on validation failure** (§6.7) — Layers 1 (pre-PR retry) and 2 (PR check) ship in Phase 2. Layer 3 (commits a fix back to a failing PR) is **deferred to Phase 3, conditional on a >20% observed failure rate**, and ships paired with the `nanocollective-bot` GitHub App so we never introduce a PAT.
- **Local generation entry point** (§12.1) for prompt tuning without GitHub Actions. Uses `NC_REPOS_DIR` env var; falls back to cloning into a temp dir if not set.
- **Reference fetching fails loudly** if `llms.txt` 404s or any referenced doc 404s. Human intervention is the intended outcome on docs unavailability.

## 15. Open Questions

Rounds 1, 2, and 3 are all answered. The plan is build-ready. Remaining unblockers are operational, not design:

1. ~~**Cloudflare Zero Trust enablement**~~ — done 2026-04-30.
2. **`MINIMAX_API_KEY` provisioned** as a GitHub Action secret on this repo (needed for Phase 2 generation runs).

Once Q1 is done, Phase 1 can ship (Next.js scaffold + copy from `../website` + Cloudflare Pages + Access policy). Phases 1 and 2 can be developed in parallel — Phase 1 has no dependency on the generation pipeline existing because we can hand-author a sample `content/nanocoder/0.0.0/` for the UI to render.

---

## Appendix A — Concrete file map

The Next.js app sits at the repo root (matching `../website`'s layout) so Cloudflare Pages needs no custom build root.

```
contentforest/
├── docs/
│   ├── planning.md                                  ← this file
│   ├── implementation.md                            ← progress tracker
│   ├── adding-a-product.md                          ← phase 3
│   └── runbook.md                                   ← phase 3
├── pages/
│   ├── _app.tsx
│   ├── _document.tsx
│   ├── index.tsx                                    ← product grid
│   ├── p/[product]/index.tsx                        ← versions list
│   └── p/[product]/[version].tsx                    ← file viewer (getStaticPaths)
├── components/
│   ├── ui/                                          ← from website, verbatim
│   ├── Navbar.tsx                                   ← rebranded, "Sign out" → /cdn-cgi/access/logout
│   ├── Footer.tsx
│   ├── ThemeToggle.tsx                              ← from website, verbatim
│   ├── FileTree.tsx
│   └── MarkdownPane.tsx
├── lib/
│   ├── content.ts                                   ← reads content/ from disk at build time
│   └── utils.ts
├── styles/globals.css                               ← from website, verbatim
├── public/
├── next.config.ts                                   ← output: "export", distDir: "dist"
├── package.json
├── tsconfig.json
├── biome.json
├── postcss.config.mjs
├── components.json
├── content/                                         ← generated artefacts (committed)
│   ├── index.json
│   ├── <product>/<version>/...
│   └── _test/                                       ← dry-run output, never auto-published
├── config/
│   ├── products.json
│   ├── channels.json
│   └── team.json
├── prompts/
│   └── release-pack.md                              ← templated prompt fed to nanocoder
├── agents.config.json                               ← Nanocoder provider config (MiniMax M2.7)
├── .nanocoder/
│   └── agents/
│       └── release-content-generator.md
├── _refs/                                           ← gitignored; populated per run by fetch-refs.ts
├── scripts/
│   ├── fetch-refs.ts                                ← fetches llms.txt + referenced .md files
│   ├── detect-releases.ts
│   ├── generate-content.ts
│   ├── validate-content.ts
│   ├── generate.local.ts                            ← local entry point (§12.1)
│   └── seed-fixtures.ts                             ← pulls latest releases into content/_test/
└── .github/
    └── workflows/
        ├── daily-content.yml                        ← cron + workflow_dispatch (product, version, dry_run)
        ├── validate-content.yml                     ← PR check on content/**
        ├── auto-fix.yml                             ← Layer 3 of §6.7 (commits fixes to failing PRs)
        └── weekly-content.yml                       ← phase 3
```

No `middleware.ts`, no `pages/api/` — auth is handled outside the app by Cloudflare Access, and there is nothing to write back.

## Appendix B — References

- Website: `../website` — stack source of truth.
- Existing release action: `../nano-coder/.github/workflows/generate-release-content.yml` — to be retired.
- Nanocoder CLI entry: `../nano-coder/source/cli.tsx`.
- Brand guidelines: `../docs/content/collective/organisation/brand.md`.
- Project conventions: `../docs/content/collective/projects/creating-a-new-project.md`.
