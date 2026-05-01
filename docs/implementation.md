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

**Handoff state.** v1 pipeline is end-to-end working as of 2026-04-30. Cloudflare Access live, drip-articles folded into the release pack, personal content rendering. Next agent / contributor should read [`handoff.md`](./handoff.md) first.

**v2 four-agent pipeline — code landed 2026-04-30, awaiting local verification.** Steps 1–3 of the migration plan in planning §6.4.3 are done: four new prompts under `prompts/agents/`, `--phase` flag on the validator, orchestrator rewritten to loop a four-agent pipeline (release-channels → release-personal → article-channels → article-personal) with per-agent retry and per-phase validation. v1 prompt (`prompts/release-pack.md`) is left on disk as a reference but is no longer wired into the orchestrator. Steps 4–6 (local A/B against a real release, delete v1 prompt + planning copy edits) are Will's verification step before flipping CI over.

**Homepage redesign + signed-in user identity — landed 2026-04-30** (handoff items 3 + 4). Home page now mirrors the Nano Collective website: full-bleed three.js / ASCII hero (`components/EffectScene.tsx` + `components/AsciiEffect.tsx` copied verbatim from `../website`, video asset `public/video/cat-in-city.mp4` reused), ContentForest-themed hero copy ("Release content for the Nano Collective. Browse, copy, post."), Browse packs / Repo CTAs, product grid extracted into `components/home/ProductGrid.tsx` with `card-hover-glow` re-enabled. Navbar reads `/cdn-cgi/access/get-identity` via `hooks/useIdentity.ts` and renders an avatar (GitHub `<login>.png`) + display name when present; renders the existing sign-out-only state otherwise (local dev, where the endpoint 404s). Three.js deps pinned to website versions. `pnpm types` / `pnpm lint` / `pnpm build` clean; dev server smoke-tested at `/` and `/p/nanocoder`.

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
- [x] First real run against latest Nanocoder release (manual dispatch, `dry_run=false`)
- [x] PR opens, validator passes, human review, merge
- [x] Site rebuilds, new pack visible at `/p/nanocoder/<version>/`
- [x] Backfill: dispatch one run per other product (Nanotune, get-md, json-up) on their latest release

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
| 2026-04-30 | Nanocoder invocation switched from `--mode auto-accept` to `--mode yolo`. | `auto-accept` still prompts for bash and destructive git, which would hang the CI workflow indefinitely (no human to approve). yolo runs every tool without prompting. Blast radius is bounded by the prompt contract ("don't run bash") and the scoped working directory. Planning §6.3 updated. |
| 2026-04-30 | **Nanocoder spawned via `script(1)` pty wrap on non-TTY parents (CI).** Direct `spawn("nanocoder", ...)` is still used when stdout is a TTY (local laptop). | First CI run failed with `Raw mode is not supported on the current process.stdin` — Nanocoder's UI is built on Ink (React-for-terminals), and `cli.tsx` calls `render(<App nonInteractiveMode/>)` unconditionally even in `run` mode. Ink hooks raw-mode on stdin which crashes when stdin isn't a TTY. `script -qec "<cmd>" /dev/null` allocates a pty (util-linux, present on `ubuntu-latest`). Prompt is passed via a temp file with `$(cat …)` substitution to avoid shell-escaping the markdown body. |
| 2026-04-30 | **Daily workflow now distinguishes system failures from content failures.** System failure (no channel files written) → wipe pack, delete branch, fail the workflow. Content failure (validator hard-fails on present files) → still open PR with `failed-validation` label. PR-creation failure → delete remote branch and fail. | Caught when the first CI run pushed a junk branch with only `meta.json` and the workflow still reported success. The new flow: if `find content/<p>/<v>/channels -name '*.md'` is empty, treat as system failure (Nanocoder Ink crash, API key bad, model 404, etc.) — clean up, exit 1. Otherwise we have real content, push it. If `gh pr create` fails (e.g. permissions not granted yet), delete the orphan remote branch so the idempotency guard doesn't block retries. |
| 2026-04-30 | ~~Orchestrator pre-writes `nanocoder-preferences.json` with cwd added to `trustedDirectories`.~~ Superseded — see next entry. | Nanocoder shows a "Do you trust this folder?" prompt on every fresh invocation; yolo mode doesn't bypass it. Was the actual cause of the second CI hang (visible after `script -f` flushed Ink output). |
| 2026-04-30 | **Switched to upstream `--trust-directory` flag** added to Nanocoder. Removed `ensureDirectoryTrusted()` and the `nanocoder-preferences.json` write path entirely. | Will added a CLI flag upstream that auto-trusts the working directory for the duration of the run, no prefs file needed. Cleaner: no gitignored side-effect file in the repo, no merge concerns with user-level prefs. Both spawn paths (TTY + script-wrapped) pass `--trust-directory`. |
| 2026-04-30 | **Cloudflare Access binding was missing/wrong** — site was unauthenticated and `/cdn-cgi/access/logout` 404'd. Will reconfigured the application via the new Cloudflare dash location (Zero Trust UI has been merged into the main dash). | Symptom of Access not being active on the hostname is `/cdn-cgi/access/*` paths 404'ing — those routes only resolve when an Access application is intercepting the domain. Direct URL `https://one.dash.cloudflare.com/<account-id>/access/apps` is the most stable route to the applications list while Cloudflare keeps moving the UI. |
| 2026-04-30 | **v2 four-agent pipeline redesign captured in planning §6.4.3, deferred to next agent.** v1 single-prompt path stays in place during migration; v2 ships as a parallel code path until verified locally, then v1 is deleted. | Will identified that a single Nanocoder invocation handling announcement-channels + announcement-personal + 0–3 article-channels + article-personal is too much surface for one model pass — output quality drifts across slices. v2 splits into four focused sequential agents with smaller prompts and per-agent validation phases. Capture-and-handoff rather than mid-context implement: the migration is ~45min of focused edits and benefits from the next agent's fresh context. |
| 2026-04-30 | **v2 pipeline landed in code (steps 1–3 of migration plan).** New prompts at `prompts/agents/{release-channels,release-personal,article-channels,article-personal}.md`. Validator gained `--phase {channels,personal,articles,personal-articles,full}`; default stays `full` for back-compat with the Layer-2 PR check and the seed-fixtures path. Orchestrator (`scripts/generate-content.ts`) replaced with `runAgentPipeline` looping the four agents; per-agent retry uses the same `--max-retries` flag (renamed internally to `maxAttemptsPerAgent`). Per-agent failure writes `meta.json` with `final_status: "failed-validation"` + `failed_agent: <slug>` and aborts subsequent agents. v1 single-prompt code path replaced wholesale rather than gated behind a flag — `prompts/release-pack.md` stays on disk as reference until Will A/Bs against a real release. | Steps 1–3 are mechanical — extract prompts, thread phase, loop agents. Steps 4–6 (local A/B, delete v1 prompt + planning copy edits) need a real Nanocoder run with the API key and Will's eyes on the output, so they don't belong in the same agent context as the refactor. Replacing wholesale (vs. gating behind a flag) is the simpler default; a `git revert` is the rollback if A/B regresses. The single-shot v1 prompt is one `git log` away if needed. |
| 2026-04-30 | **Per-agent retry budget bumped to 5 retries (default `--max-retries 6` = 1 initial + 5 retries; cost ceiling 4 × 6 = 24 spawns per pack).** Up from the planning §6.4.3 default of 2 retries. | Will's call: with the per-agent surface area now small enough that retries should be productive (vs. the v1 single-prompt where a 4th attempt was likely flailing), spend more spawns to drive the failure rate further toward zero. Wall-time worst case roughly doubles (16–30 min) but stays bounded; token cost per pack scales linearly with attempts but most agents will pass on attempt 1. |
| 2026-05-01 | **In-spawn self-validation** added to all four agent prompts. Each agent now runs `pnpm validate --pack {{PACK_ID}} --root {{VALIDATOR_ROOT}} --phase <its-phase> --report /tmp/cf-self-check.json --quiet` before declaring done, reads the report, fixes flagged files, re-validates — capped at 3 in-spawn fix cycles. The orchestrator still runs the validator after the spawn returns (gate of last resort; the model could lie about a pass) and Layer-2 PR check is unchanged. New prompt vars `PACK_ID` + `VALIDATOR_ROOT` surfaced via `buildPromptVars`. | Spawn cold-start (~10s + Ink + ref-reread) is the dominant per-attempt cost; an in-process validate is ~1s. If the model converges in one spawn instead of needing the orchestrator to spawn a fresh one, total wall-time and token cost both drop materially. The 3-cycle internal cap prevents the model from getting stuck in its own micro-loop — at that point a fresh-context outer retry is more productive than another in-context iteration. |
| 2026-05-01 | **Personal-variant agents removed; v2 collapsed from four agents to two.** Pipeline is now `release-channels` → `article-channels`. Deleted `prompts/agents/release-personal.md`, `prompts/agents/article-personal.md`, `config/team.json`. Validator phases dropped from `{channels, personal, articles, personal-articles, full}` to `{channels, articles, full}`. `expectedFiles` no longer iterates team pairs; `TeamMember` type and team config loading deleted. UI rendering of `personal/<member>/<channel>.md` in `lib/content.ts` and `FileTree.tsx` left in place for backward compatibility with older committed packs. | Will's call: per-team-member voiced posts weren't pulling weight for the cost. Generic release + article packs cover the team well enough; the team can hand-tweak voice on the rare post that needs it. Halves agent count, halves spawn ceiling (24 → 12), removes a pending TODO (populating team.json voice notes), and clarifies the pack shape. The v1 prompt (`prompts/release-pack.md`) still references team.json — A/B'ing v1 cleanly would require restoring the file temporarily; flagged in handoff §1 step 6. |
| 2026-05-01 | **Subagent-tool ban added at the prompt level** — both surviving agent prompts now include "Do not use the `agent` tool — do not delegate to subagents." | Nanocoder v1.25.2 has no first-class config switch to drop the `agent` tool from the main session: `MODE_EXCLUDED_TOOLS` only filters in scheduler mode, both `full` and `minimal` tune profiles include `agent` (per `_refs/nanocoder/docs/v1.25.2/features/subagents.md:155`), and `disallowedTools` is a subagent-only frontmatter field. Cheapest mitigation is a prompt directive — the model in yolo mode has no incentive to delegate when told not to. The proper upstream fix is a top-level `disabledTools: ["agent"]` (mirroring the existing per-subagent `disallowedTools` shape) in `agents.config.json`'s `nanocoder` block — flagged as a Nanocoder upstream patch opportunity in handoff §6. |
| 2026-05-01 | **Nanocoder `disabledTools` upstream landed; switched from prompt directive to config.** Set `nanocoder.disabledTools: ["agent"]` in `agents.config.json`. Removed the "Do not use the `agent` tool" lines from both agent prompts. | Will shipped the upstream patch hours after we identified the gap. Config-level enforcement is strictly better than the prompt directive — actually filtered by Nanocoder's tool manager (`source/tools/tool-manager.ts:117,140` + `source/config/index.ts:429`), no longer reliant on the model honoring the instruction, and applies transitively to any subagent that might somehow get spawned (`source/subagents/subagent-executor.ts:213-214` honours the global list). |
| 2026-05-01 | **GitHub-issue-driven change-request feature landed end-to-end.** Five new files — `prompts/change-request.md`, `scripts/parse-change-request.ts`, `scripts/change-request.ts`, `.github/ISSUE_TEMPLATE/change-request.yml`, `.github/workflows/change-request.yaml` — plus `change-request` and `parse-change-request` script entries in `package.json`. Triggered on `issues: opened/labeled` filtered to the `change-request` label, plus `/retry` issue comments. Workflow parses the issue body, runs the change-request orchestrator (which clones the product repo, runs Nanocoder against the existing pack with the change-request prompt, and writes a `change-request.json` audit sidecar), opens a PR with `Closes #<N>` so merge auto-closes the issue. `failed-change` label applied if the agent exhausts retries (default 3 attempts). | Built ahead of the demand-trigger noted in handoff §6 because the design was already crisp and the dependencies (Nanocoder pipeline, auto-fix prompt, validator phases, `disabledTools`, org PR-creation toggle) were all in place. Reused the spawn / pty / auto-fix pattern from `generate-content.ts` rather than extracting to a shared module — duplication is small (~80 lines per script) and avoids inventing a `scripts/lib/` convention with only two callers. Refactor when a third caller appears. The scope-discipline rule is prompt-enforced (not gated by a path allow-list in the orchestrator) — flagged in handoff §6 follow-up; revisit if the agent in practice ignores it. |
| 2026-05-01 | **Issue creation gated to public NC org members** via `.github/workflows/gate-issues.yaml`. Closes any newly-opened issue from a non-public-member with a comment pointing them at the per-product trackers + Discord. The `change-request.yaml` workflow also got a `gate` step at the top with the same membership check — emits a `member` step output and conditionals every subsequent step on it (rather than `exit 78`, which doesn't graceful-skip in GH Actions). | The repo is going public and GitHub has no permanent native "members-only" toggle for issues on public repos (only the time-limited interaction limits). The membership check uses `orgs/Nano-Collective/public_members/<user>` because the default `GITHUB_TOKEN` doesn't carry `read:org` — that means org members must have their NC membership set to public. Documented in the auto-close comment + handoff §2. The proper long-term fix is the `nanocollective-bot` GH App (handoff §6) whose token can read private memberships too. Belt-and-braces gate inside change-request.yaml prevents wasting a Nanocoder spawn if change-request happens to win the race against gate-issues on `issues: opened`. |
| 2026-05-01 | **Validator unit tests landed (26 ava tests).** `scripts/validate-content.spec.ts` — happy paths for every phase, one test per hard-rule failure the validator emits, soft-rule warnings (`min-words` + marketing-register), sample-pack skip, and legacy `personal/<member>/<channel>.md` back-compat. Fixtures are built programmatically in `tmpdir` per-test. Refactored `validate-content.ts` to expose `runValidate({ contentRoot, packFilter, phase, config })` alongside the CLI; gated the top-level `main()` on `process.argv[1] === fileURLToPath(import.meta.url)` so importing the module from the spec doesn't trigger CLI side-effects. Wired `pnpm test` into `validate-content.yaml`. Pinned `ava@^7.0.0` to match the rest of the NC stack (nano-coder, website). | The validator is now the gate for the v2 release agents' in-spawn self-check, the daily-content workflow's pack discriminator, the change-request agent's self-check, and the Layer 2 PR check — four independent callers, zero coverage was a real risk. Programmatic fixtures over committed on-disk packs because the scenarios are tightly coupled to the assertions; co-locating them in the spec keeps the test readable as one piece. ava 8 changed the `extensions` config schema from object to array (we hit it on first install); 7.x matches the nano-coder + website convention Will explicitly asked for. |
| 2026-04-30 | **CI installs Nanocoder by building from main**, not via npm registry. | Will's preference: track latest, not pinned versions. Replaces `npm install -g @nanocollective/nanocoder` with `git clone + npm install + npm run build + npm link`. Adds ~30s to runner time but means we always test against tip-of-main. The repo's `prepare: husky` script doesn't auto-build on git installs, so `npm install -g github:...` wouldn't work — manual build step is needed. |
| 2026-04-30 | **Drip articles fold into the release pack**; no separate `weekly-content.yml`. | Will's redesign: instead of a parallel weekly cron generating "in-between" marketing content, the release-pack agent identifies 0–3 angles in the same release worth a deeper drip-article and produces a full sub-pack per angle at `articles/<slug>/`. One workflow run, one PR per release contains the announcement + the drip content. Validator recurses into `articles/`, hard-caps at 3, requires kebab-case slugs and `slug`/`title`/`focus` meta fields. `lib/content.ts` and the file viewer render an "Article: <title>" section per slug under the release section. Planning §7 + §11 rewritten; Phase 3 weekly job deleted from the phasing list. |
| 2026-04-30 | `lib/content.ts` walks nested `personal/<member>/<channel>.md` (was flat-only). FileTree splits into "Release" + "Article: <title>" sections. | Personal posts produced by Nanocoder weren't appearing in the file viewer because the reader only handled flat `personal/*.md`. Fixed alongside the articles work — same recursive read pattern, both nested and flat handled. |

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
