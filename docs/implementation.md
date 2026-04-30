---
title: ContentForest — Implementation Tracker
status: live
owner: Will Lamerton
last_updated: 2026-04-30
---

# ContentForest — Implementation Tracker

The companion to [`planning.md`](./planning.md). Planning doc is the **what and why**; this doc is the **what's-done, what's-next, and what surprised us**.

## How to use this doc

- Tick boxes as work lands. Add the date in `(YYYY-MM-DD)`.
- When a task changes shape during build, **edit the task line in place** — don't leave stale wording.
- New work that wasn't in the plan goes into the relevant phase. If it's a real design change, also update `planning.md`.
- The **Decision log** at the bottom captures deviations from the plan. The **Blockers** section captures anything stopping forward motion.

## Current focus

**Phase 1 in flight.** Next.js app scaffolded at repo root (build green, dev server confirmed serving the sample pack). Remaining Phase 1 work is the Cloudflare Pages deploy + Access policy.

---

## Phase 0 — Scaffold

- [x] Planning doc v3 written (`docs/planning.md`) (2026-04-30)
- [x] All design questions resolved (rounds 1–3) (2026-04-30)
- [x] Cloudflare Zero Trust enabled on the Nano Collective account (2026-04-30)
- [x] GitHub OAuth App created under `Nano-Collective` org (2026-04-30)
- [x] GitHub identity provider wired into Zero Trust and tested (2026-04-30)
- [x] Implementation tracker created (this doc) (2026-04-30)

**Phase 0 done.**

---

## Phase 1 — Static web shell + Cloudflare deploy

Goal: a deployed, gated, empty file viewer at `contentforest.nanocollective.org` rendering one hand-authored sample release pack.

### Web app scaffold
- [x] Initialise Next.js 15 + Pages Router + TypeScript + pnpm (2026-04-30)
- [x] Configure Tailwind 4 via PostCSS, no `tailwind.config.js` (2026-04-30)
- [x] Set `next.config.ts` to `output: "export"`, `distDir: "dist"` (2026-04-30)
- [x] Add Biome with the website's `biome.json` as starting point (2026-04-30)
- [x] Configure Turbopack for dev/build (2026-04-30)

### Style + components from `../website`
- [x] Copy `styles/globals.css` verbatim (2026-04-30)
- [x] Copy `components/ui/button.tsx` and `components/ui/card.tsx` verbatim (2026-04-30)
- [x] Copy and rebrand `Navbar.tsx` — title "ContentForest", repo link, "Sign out" → `/cdn-cgi/access/logout` (2026-04-30)
- [x] Lightweight `Footer.tsx` (drop website's social-link variant) (2026-04-30)
- [x] Copy `ThemeToggle.tsx` verbatim (2026-04-30)
- [x] Copy + adapt `_document.tsx` (kept theme script + Google Fonts; dropped JSON-LD, OG/Twitter cards, RSS links — added `noindex, nofollow`) (2026-04-30)

### Pages
- [x] `pages/index.tsx` — product grid (reads `content/` from disk via `lib/content.ts`) (2026-04-30)
- [x] `pages/p/[product]/index.tsx` — versions list (2026-04-30)
- [x] `pages/p/[product]/[version].tsx` — file viewer (two-pane: tree + markdown preview, Preview/Raw toggle) (2026-04-30)
- [x] `components/FileTree.tsx` (2026-04-30)
- [x] `components/MarkdownPane.tsx` — renders with `marked`, "Copy" + "Download" buttons (2026-04-30)
- [x] `lib/content.ts` — filesystem reader for `getStaticProps` / `getStaticPaths` (2026-04-30)

### Sample content
- [x] Hand-author `content/nanocoder/0.0.0/{release.md, meta.json, channels/{linkedin,x,reddit,github-discussion}.md}` (2026-04-30)
- [x] Add `content/index.json` with the four products (2026-04-30)
- [x] Add `content/nanocoder/index.json` (2026-04-30)

### Verification
- [x] `pnpm types` — clean (2026-04-30)
- [x] `pnpm build` — clean, 5 static pages exported (2026-04-30)
- [x] `pnpm dev` — all three routes serve 200 with the sample pack rendering (2026-04-30)

### Cloudflare Pages
- [ ] Create Pages project under the Nano Collective Cloudflare account
- [ ] Connect to this GitHub repo, set build command `pnpm build`, output dir `dist/` (or whatever `next build` writes when `output: "export"` is set)
- [ ] Add custom domain `contentforest.nanocollective.org`
- [ ] DNS: CNAME `contentforest` → Cloudflare Pages target

### Cloudflare Access policy
- [ ] Zero Trust → Access → Applications → Add → Self-hosted
- [ ] Application name: ContentForest, domain `contentforest.nanocollective.org`
- [ ] Identity providers: GitHub only
- [ ] Policy: Include → GitHub organisation → `Nano-Collective`
- [ ] Test login flow: signed-in member can view, non-member is blocked
- [ ] Test logout via `/cdn-cgi/access/logout`

**Phase 1 exit criteria:** browse `contentforest.nanocollective.org`, log in with GitHub, see the sample Nanocoder 0.0.0 pack rendered.

---

## Phase 2 — Generation pipeline

Goal: daily cron + manual dispatch produce real release packs as PRs, with the three-layer auto-fix loop in place.

### Config
- [ ] `config/products.json` (4 products)
- [ ] `config/channels.json` (5 channels with length rules)
- [ ] `config/team.json` — Will populates with per-channel handles + voice notes
- [ ] `agents.config.json` — Nanocoder provider config pointing at MiniMax M2.7
- [ ] Provision `MINIMAX_API_KEY` as repo secret
- [ ] Provision `NC_BOT_TOKEN` PAT (`contents: write`, `pull-requests: write`) as repo secret

### Agent + prompts
- [ ] `.nanocoder/agents/release-content-generator.md` — agent definition
- [ ] `prompts/release-pack.md` — templated initial prompt
- [ ] `prompts/auto-fix.md` — templated retry prompt (re-uses original + error report)

### Scripts
- [ ] `scripts/fetch-refs.ts` — fetch `llms.txt` + every referenced doc into `_refs/`, fail loudly on 404
- [ ] `scripts/detect-releases.ts` — diff GitHub releases against `content/<product>/index.json`
- [ ] `scripts/generate-content.ts` — invoke Nanocoder, capture output, run validator, retry up to 3 times (Layer 1)
- [ ] `scripts/validate-content.ts` — hard rules + soft rules, emit `validation-report.json`
- [ ] `scripts/generate.local.ts` — local entry point honouring `NC_REPOS_DIR`, output to `content/_local/` by default
- [ ] `scripts/seed-fixtures.ts` — pull latest releases into `content/_test/` for prompt-tuning

### Workflows
- [ ] `.github/workflows/daily-content.yml` — cron 08:00 UTC + `workflow_dispatch` (`product`, `version`, `dry_run`)
- [ ] `.github/workflows/validate-content.yml` — Layer 2 PR check on `content/**`
- [ ] `.github/workflows/auto-fix.yml` — Layer 3, listens for `validate-content` failures on `auto/*` branches, capped at 2 attempts via `auto-fix-attempts/N` labels

### End-to-end
- [ ] First real run against latest Nanocoder release (manual dispatch, `dry_run=false`)
- [ ] PR opens, validator passes, human review, merge
- [ ] Site rebuilds, new pack visible at `/p/nanocoder/<version>/`
- [ ] Backfill: dispatch one run per other product (Nanotune, get-md, json-up) on their latest release

**Phase 2 exit criteria:** four merged release packs (one per product), the daily cron is enabled, and at least one PR has been auto-fixed by Layer 1 or Layer 3 successfully.

---

## Phase 2.5 — Testing strategy (within Phase 2)

- [ ] `dry_run=true` writes to `content/_test/<product>/<version>/`, PR labelled `test`
- [ ] `_test/` and `_local/` paths in `.gitignore` for the local case
- [ ] Document local workflow in `docs/local-development.md` (Phase 3 candidate but draft now if it helps onboarding)

---

## Phase 3 — Retire old action + weekly content

- [ ] `weekly-content.yml` — Mondays 08:00 UTC, generates a full content pack per product (same shape as a release pack) into `content/<product>/_evergreen/<yyyy-mm-dd>/`
- [ ] Delete `nano-coder/.github/workflows/generate-release-content.yml`
- [ ] `docs/adding-a-product.md` — operator-facing version of planning §7.2
- [ ] `docs/runbook.md` — failure recovery, rollback, manual rerun
- [ ] `docs/local-development.md` — local generation workflow
- [ ] **Conditional:** create `nanocollective-bot` GitHub App, replace `NC_BOT_TOKEN` PAT

---

## Phase 4 — Out of scope (recorded so they stay deferred)

- ❌ Posting integrations (one-click to LinkedIn / X / Reddit)
- ❌ Search inside the file viewer
- ❌ Stale-PR auto-close routine
- ❌ Per-channel official voice variants (uniform brand voice everywhere — confirmed)

---

## Decision log

Deviations from `planning.md` made during build. If something here is load-bearing, also reflect it in the planning doc.

| Date       | Decision                                                                                                        | Why                                                                                          |
|------------|------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| 2026-04-30 | Cloudflare's "Login methods" page is now under **Zero Trust → Settings → Authentication** (or **Integrations → Identity providers**). | UI moved since first draft of planning doc; instructions updated.                            |
| 2026-04-30 | Next.js app sits at **repo root**, not under `web/`. `content/`, `scripts/`, `prompts/`, `.nanocoder/` are siblings of `pages/`, `components/`, `lib/`. | Mirrors the website's layout, simpler Cloudflare Pages config (no custom build root needed). Planning Appendix A updated. |
| 2026-04-30 | Frontmatter is JSON-roundtripped in `lib/content.ts` to convert gray-matter's parsed `Date` objects to ISO strings. | Next's `getStaticProps` requires JSON-serializable props; `Date` instances throw at build.   |
| 2026-04-30 | Build deps trimmed vs `../website`: dropped `@react-three/*`, `recharts`, `feed`, `next-sitemap`, `eslint-*`, `react-avatar`, `react-select`. | None of those are used by a file viewer; smaller install + smaller surface to maintain.      |
| 2026-04-30 | `_document.tsx` uses `noindex, nofollow` and no Open Graph or RSS tags.                                          | Private internal site behind Access; SEO and OG previews are not relevant.                   |
| 2026-04-30 | The version page is `pages/p/[product]/[version].tsx` (a file route, not a folder route).                        | Cleaner with no folder-index file; only one route exists per version.                        |
| 2026-04-30 | Theme swapped from website's Tokyo Night to **Everforest** (light + dark) — Nanocoder's terminal theme.          | Visual continuity with Nanocoder where most release content originates; user preference.     |
| 2026-04-30 | Navbar trimmed: dropped nav links (Browse / Repo) and GitHub icon; left = brand, right = theme toggle + sign-out only. | Internal tool with three pages — nav links are noise, the brand text already links Home.    |
| 2026-04-30 | Layout container standardised on `max-w-6xl mx-auto px-4` for both navbar and pages.                             | Tailwind 4's `container` class caps at the active breakpoint; pages with `container max-w-6xl` were wider than the navbar at 2xl viewports, causing left-edge misalignment. |

---

## Blockers

_None._

---

## Reference URLs (live)

- Cloudflare Pages project: _TBD — fill in once created_
- Cloudflare Access app: _TBD — fill in once created_
- GitHub OAuth App: `https://github.com/organizations/Nano-Collective/settings/applications` (private)
- Production URL: `https://contentforest.nanocollective.org` _(not yet routable)_
- Cloudflare team subdomain: _TBD — fill in from Phase 0 step 1.3_
