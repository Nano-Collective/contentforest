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

**Phase 2 nearly done.** First real Nanocoder run produced a quality pack on the first try (`content/_test/nanocoder/1.25.2/`). Orchestrator, validator, prompts, both workflows, and Layer 1 retry all in place. Remaining: ① promote the test pack to `content/` (or `--commit` re-run), ② backfill the other 3 products as PRs, ③ enable the cron once we're happy.

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
Deploy pattern mirrors `../website`: GitHub Actions builds and pushes to Pages via API token (not Cloudflare auto-pulling from Git). Build runs in CI where lint + types are gated.

- [x] `.github/workflows/deploy-cloudflare-pages.yaml` — runs on push to main + workflow_dispatch (2026-04-30)
- [x] Create Pages project `contentforest` under the Nano Collective Cloudflare account as **Direct Upload** type (no Git connection) (2026-04-30)
- [x] Generate Cloudflare API token (scope: `Account → Cloudflare Pages → Edit`) — stored as repo secret `CLOUDFLARE_API_TOKEN` (2026-04-30)
- [x] Cloudflare Account ID stored as repo secret `CLOUDFLARE_ACCOUNT_ID` (2026-04-30)
- [x] First push to `main` succeeded; build → deploy pipeline live (2026-04-30)
- [x] Custom domain `contentforest.nanocollective.org` live (2026-04-30)

### Cloudflare Access policy
- [x] Self-hosted Access app on `contentforest.nanocollective.org`, GitHub IdP only, policy = `Nano-Collective` org membership (2026-04-30)
- [x] Login flow tested (2026-04-30)
- [x] Logout via `/cdn-cgi/access/logout` tested (2026-04-30)

**Phase 1 done** — `contentforest.nanocollective.org` is live, gated, and rendering the sample pack.

---

## Phase 2 — Generation pipeline

Goal: daily cron + manual dispatch produce real release packs as PRs, with the three-layer auto-fix loop in place.

### Config
- [x] `config/products.json` (4 products) (2026-04-30)
- [x] `config/channels.json` (5 channels with length rules) (2026-04-30)
- [x] `config/team.json` — skeleton with one Will entry; voice_notes marked TODO for population from existing repo (2026-04-30)
- [x] `agents.config.json` — MiniMax provider config (OpenAI-compatible endpoint, reads `MINIMAX_API_KEY`) (2026-04-30)
- [ ] Populate `config/team.json` voice_notes (Will, from existing repo)
- [ ] Provision `MINIMAX_API_KEY` as repo secret

### Prompts (no subagent — see decision log)
- [x] `prompts/release-pack.md` — templated initial prompt; brand voice + channel specs + validation contract baked in; `{{VAR}}` placeholders for the orchestrator to fill (2026-04-30)
- [x] `prompts/auto-fix.md` — templated retry prompt with embedded `validation-report.json` errors + original prompt for context (2026-04-30)

### Scripts
- [x] `scripts/fetch-refs.ts` — fetches `llms.txt` + every referenced doc into `_refs/`, fails loudly on 404, `--allow-partial` for local. Verified: 97 docs pulled live (2026-04-30)
- [x] `scripts/validate-content.ts` — hard + soft rules, frontmatter shape, length, forbidden terms, link target, placeholders; emits `validation-report.json`. Skips packs with `final_status: "sample"`. Verified clean against the seed pack (2026-04-30)
- [x] `scripts/detect-releases.ts` — diff GitHub releases against `content/<product>/index.json`, emit job specs as JSON. Verified live: detects current releases for all 4 products (2026-04-30)
- [x] `scripts/generate-content.ts` — orchestrator: resolves repo path (NC_REPOS_DIR or shallow clone), fetches release body via gh, substitutes prompt vars, invokes `nanocoder run --mode auto-accept`, runs validator, retries on failure with auto-fix prompt up to 3 times (Layer 1), writes `meta.json` with attempt counters and final_status. Modes: default `--commit`-less to `content/_local/`, `--commit` to `content/`, `--test` to `content/_test/`. `--dry-run` prints substituted prompt without invoking Nanocoder (2026-04-30)
- [x] `generate.local` collapsed into `generate-content.ts` — same script handles local + workflow paths (decision log entry below) (2026-04-30)
- [x] `scripts/seed-fixtures.ts` — wraps `pnpm generate --test` for each product's latest release; skips already-seeded packs unless `--force` (2026-04-30)
- [x] Added `pnpm generate` / `pnpm detect-releases` / `pnpm seed-fixtures` scripts in `package.json` (2026-04-30)

### Workflows (Phase 2 ships Layers 1 + 2 only; Layer 3 deferred)
- [x] `.github/workflows/daily-content.yaml` — cron 08:00 UTC + `workflow_dispatch` (`product`, `version`, `dry_run`); installs nanocoder via npm; bootstraps PR labels; loops over `pnpm detect-releases` output, calls `pnpm generate --commit`, opens one PR per pack with `auto-release` (and `failed-validation` if hard rules failed). Skips packs whose branch already exists on origin to prevent duplicates on retried runs (2026-04-30)
- [x] `.github/workflows/validate-content.yaml` — Layer 2 PR check; runs `pnpm validate` on every PR touching `content/**` or relevant configs; uploads `validation-report.json` as an artifact (2026-04-30)
- ⏸ `.github/workflows/auto-fix.yaml` — **deferred to Phase 3, conditional on observed failure rate (>20% of PRs landing with `failed-validation`).** Will ship paired with the `nanocollective-bot` GitHub App so we never introduce a PAT.

### End-to-end
- [ ] First real run against latest Nanocoder release (manual dispatch, `dry_run=false`)
- [ ] PR opens, validator passes, human review, merge
- [ ] Site rebuilds, new pack visible at `/p/nanocoder/<version>/`
- [ ] Backfill: dispatch one run per other product (Nanotune, get-md, json-up) on their latest release

**Phase 2 exit criteria:** four merged release packs (one per product), the daily cron is enabled, and at least one PR has been auto-fixed by Layer 1 successfully (and we have a measurement of how often Layer 1 alone is sufficient — informs the Layer-3 build/skip decision in Phase 3).

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
- [ ] **Conditional (gated on >20% of release-pack PRs landing with `failed-validation` over the first month of Phase 2):** create `nanocollective-bot` GitHub App and ship `auto-fix.yml` (Layer 3). Doing both together avoids ever needing a PAT.

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
| 2026-04-30 | Cloudflare Pages deploy via **GitHub Actions push** (not the dashboard's "Connect to Git" auto-pull), mirroring the website. | Build runs in CI where lint + types are gated. Pages project is Direct Upload only; secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` provisioned on the GH repo. `cloudflare/pages-action@v1` is the action — note: officially deprecated by Cloudflare in favour of `cloudflare/wrangler-action@v3`, but the website still uses v1 so we match for consistency; revisit if it breaks. |
| 2026-04-30 | First two CI runs failed on Biome's `assist/source/organizeImports` rule (imports/exports not alphabetised in `components/ui/card.tsx` and `lib/content.ts`). Fixed by `pnpm lint:fix` and re-pushed. | The CI runs `pnpm run lint` (`biome check`, no auto-fix) so any unsorted imports break the build. Treat `pnpm lint:fix` as the pre-commit reflex when adding new files; the existing IDE biome assist will normally handle it on save but didn't in the initial scaffold burst. |
| 2026-04-30 | **Layer 3 of the auto-fix loop deferred from Phase 2 to Phase 3** (conditional). Phase 2 ships only Layers 1 + 2. No PAT introduced. | Layer 3 needs to push commits that re-trigger `validate-content.yml`. The default `GITHUB_TOKEN` won't fire downstream workflows, so Layer 3 needs either a fine-grained PAT or a GitHub App. Both add operational overhead. Layer 1's 3-retry loop likely catches most failures; we'll measure for a month and only build Layer 3 if >20% of PRs need a human edit. When we do, we'll pair it with the `nanocollective-bot` GitHub App provisioning so we never carry a PAT. Phase 2 is also simpler — `MINIMAX_API_KEY` is the only new secret. |
| 2026-04-30 | `meta.json` keys are **snake_case**, matching frontmatter (`generated_at`, `final_status`, `auto_fix_attempts`). | First sample used camelCase (`generatedAt`, `finalStatus`); validator checks snake_case so the sample failed the gate. One convention everywhere is the simplest fix. |
| 2026-04-30 | Personal-account file layout supports **both** `personal/<member>/<channel>.md` (preferred) and flat `personal/<member>-<channel>.md` (fallback). Validator accepts either. | Locks the directory layout decision in code; the agent can pick the cleaner nested form, but if a future tool emits flat files the validator still passes. |
| 2026-04-30 | `agents.config.json` declares MiniMax via the Anthropic-compatible endpoint at `https://api.minimax.io/anthropic/v1`, with `sdkProvider: "anthropic"` and `apiKey: "${MINIMAX_API_KEY}"` (inline env substitution). Wrapped under `nanocoder.providers` (array) per the official Nanocoder schema. | First draft used the wrong format (OpenAI-compatible, no wrapper, fake `apiKeyEnv` field); rewrote against `_refs/nanocoder/docs/v1.25.2/configuration/providers/minimax.md`. Model string `minimax-m2.7` is a placeholder — Will confirms when provider is wired up. |
| 2026-04-30 | Dropped `release.md` from the schema — `channels/github-discussion.md` is now the canonical long-form artifact. The website's blog reads from GitHub Discussions on `Nano-Collective/website`, so the GH-Discussion file IS the public release blog post. | `release.md` and `github-discussion.md` were duplicates by design; one source of truth is simpler. Validator, lib/content, FileTree, version page, planning §7 + §10 all updated. `github-discussion` word range bumped to 300–1500 to fit a real release blog. |
| 2026-04-30 | **Dropped the `.nanocoder/agents/release-content-generator.md` subagent file** in favour of templated prompt files at `prompts/release-pack.md` and `prompts/auto-fix.md` fed directly to `nanocoder run`. | Misread of the Nanocoder subagent feature in the original plan: subagents are explicitly *for delegation from a main agent*, are unavailable in scheduler mode, and require user approval that's awkward in non-interactive runs (per `_refs/nanocoder/docs/v1.25.2/features/subagents.md`). For our automated single-task generation, a plain prompt file with `{{VAR}}` placeholders that the orchestrator fills is simpler and works cleanly with `--mode auto-accept`. Planning §6.4 rewritten. |
| 2026-04-30 | **`config/products.json` repo names corrected** from `Nano-Collective/nano-coder` → `Nano-Collective/nanocoder` (no hyphen) and propagated to sample content + planning examples. | Caught during the first dry run when `git clone` 404'd. The actual GH repo names (verified via `gh repo list Nano-Collective`) are `nanocoder`, `nanotune`, `get-md`, `json-up` — the hyphen in `nano-coder` was just Will's local folder name. |
| 2026-04-30 | `generate.local.ts` collapsed into `scripts/generate-content.ts`. One script, two entry styles: `--product X --version Y` (local) or `--job-spec '{...}'` (workflow). | Was originally planned as two files in planning Appendix A, but the only difference was where the job spec comes from. Same code, simpler. |
| 2026-04-30 | All scripts use `parseArgs({ allowPositionals: true })`. | pnpm forwards a literal `--` separator before user args (`pnpm generate -- --product X`); without `allowPositionals` parseArgs throws. With it, `--` is silently ignored and `--product` parses correctly. Both `pnpm generate --product X` (no `--`) and `pnpm generate -- --product X` (with `--`) now work. |
| 2026-04-30 | `tsconfig.json` excludes `_refs`, `_repos`, `content/_local`, `content/_test`. | The shallow-cloned `_repos/<product>` tree contains TS that references `@/*` paths from those repos' tsconfigs and breaks our `tsc --noEmit`. Same for ref docs (markdown only, but harmless to exclude). |
| 2026-04-30 | **First real Nanocoder run worked end-to-end** — wrote channels (linkedin, x, reddit, github-discussion), personal/will/{linkedin,x}.md, and meta.json into `content/_test/nanocoder/1.25.2/`. Validator caught 3 real failures (all `min-words` shortfalls of 5–15%) — exactly the case Layer 1 retry exists for. | Two bugs surfaced: (1) the orchestrator's `runValidator` passed `_test/nanocoder/1.25.2` as `--pack`, which the validator parsed as `productSlug=_test, version=nanocoder`. Fixed by adding `--root` flag to the validator and computing `<product>/<version>` cleanly in the orchestrator. (2) `runValidator` swallowed stderr with `stdio: "ignore"` so when the validator exited 2 with no report, the orchestrator died on a confusing ENOENT. Now captures stderr and reports it on failure. |
| 2026-04-30 | ~~Prompt nudge: "Aim for the middle of each range, not the floor."~~ | Reverted — see next entry. |
| 2026-04-30 | **`min_words` moved from hard rule to soft warning.** Hard rules now enforce ceilings only (max_chars, max_words). | Will's call: minor patch releases (e.g. "updated docs to align with brand guidelines") genuinely don't have ≥N words of substance, and padding to hit a floor produces exactly the filler the brand voice forbids ("be specific", "trust the reader"). Soft warning still surfaces in the validator report so reviewers can sanity-check on substantive releases. Prompt updated: "for minor patches with little to communicate write only what the release warrants." Auto-fix prompt's rule list trimmed to drop `min-words`. Planning §6.6 updated. |
| 2026-04-30 | `daily-content.yaml` PR body uses `printf` to build the body string instead of a heredoc. | YAML's `run: \|` block scalar can't contain a heredoc whose body lines de-indent past the script's leading column — the `EOF` body breaks block-scalar parsing. `printf` keeps the whole body on indented lines and is more portable. |
| 2026-04-30 | `daily-content.yaml` skips packs whose `auto/release-<product>-<version>` branch already exists on origin. | Prevents duplicate PRs when the workflow is re-run (e.g. cron fires on a release that already got a PR from a manual dispatch). The branch check is the simplest idempotency guard. |

---

## Blockers

_None._

---

## Reference URLs (live)

- Repo: `https://github.com/Nano-Collective/contentforest`
- CI: `https://github.com/Nano-Collective/contentforest/actions`
- Production URL: `https://contentforest.nanocollective.org` (gated by Cloudflare Access)
- Cloudflare Pages project: `contentforest` (Direct Upload, on the Nano Collective account)
- Cloudflare Access app: `ContentForest` on `contentforest.nanocollective.org`
- GitHub OAuth App: `https://github.com/organizations/Nano-Collective/settings/applications` (private)
