---
title: ContentForest — Handoff
status: live
owner: Will Lamerton
last_updated: 2026-04-30
---

# ContentForest — Handoff

You are picking up ContentForest mid-flight. **Read this file first**, then `planning.md` (design + decisions) and `implementation.md` (what's done + decision log + reference URLs). Everything material is captured in those three files; the conversation history is not load-bearing.

## TL;DR

ContentForest is an internal tool at `contentforest.nanocollective.org` that:

1. Detects new releases across Nano Collective product repos.
2. Runs Nanocoder (in non-interactive `run` mode, `--mode yolo`, pty-wrapped) with a templated prompt to generate a complete content pack per release: a headline announcement (linkedin / x / github-discussion / reddit + per-team-member personal variants) plus 0–3 deep-dive "drip article" sub-packs for the weeks following the release.
3. Validates the output (frontmatter, length ceilings, forbidden brand terms, link target, etc.); retries up to 3× with a structured error report (Layer 1 of the auto-fix loop) on failure.
4. Opens one PR per release pack to `main`. Cloudflare Access gates the site; only `Nano-Collective` org members can browse the file viewer.

The pipeline is **end-to-end working** as of 2026-04-30. There are concrete operational and product items remaining, listed below.

## Repo orientation in 60 seconds

```
.
├── content/<product>/<version>/        ← committed packs (PR-merged content)
│   ├── meta.json                       ← orchestrator-written attempt counters + final_status
│   ├── channels/*.md                   ← headline announcement
│   ├── personal/<member>/<channel>.md  ← per-member variants
│   └── articles/<slug>/                ← 0–3 drip articles per release (same shape as above)
├── prompts/
│   ├── release-pack.md                 ← templated prompt with {{VAR}} placeholders
│   └── auto-fix.md                     ← retry prompt that consumes validation-report.json
├── config/
│   ├── products.json                   ← four products today
│   ├── channels.json                   ← per-channel length rules (max=hard, min=soft)
│   ├── team.json                       ← per-channel handles + voice_notes (TODO: populate)
│   └── ../agents.config.json           ← Nanocoder provider config (MiniMax via Anthropic SDK)
├── scripts/
│   ├── fetch-refs.ts                   ← pulls llms.txt + every doc into _refs/
│   ├── detect-releases.ts              ← emits JSON jobs from live GH releases
│   ├── generate-content.ts             ← THE orchestrator (Layer 1 retry loop, --commit/--test/--local)
│   ├── validate-content.ts             ← hard + soft rules, emits validation-report.json
│   └── seed-fixtures.ts                ← bulk wrapper of generate --test for prompt tuning
├── pages/                              ← Next.js Pages Router file viewer
├── components/                         ← Navbar, Footer, FileTree, MarkdownPane, ui/*
├── lib/content.ts                      ← reads content/ at build time (now handles articles + nested personal)
├── styles/globals.css                  ← Everforest theme, copied from website + retinted
├── .github/workflows/
│   ├── deploy-cloudflare-pages.yaml    ← pnpm build → Cloudflare Pages on push to main
│   ├── daily-content.yaml              ← cron 08:00 UTC + workflow_dispatch; opens PR per pack
│   └── validate-content.yaml           ← Layer 2 PR check on content/**
├── docs/
│   ├── planning.md                     ← design + open-question rounds
│   ├── implementation.md               ← progress + decision log + reference URLs
│   └── handoff.md                      ← THIS FILE
└── _refs/, _repos/                     ← gitignored, populated per generation run
```

Every script is invokable via `pnpm <name>`:

```bash
pnpm dev                                     # local dev server
pnpm build                                   # static export to dist/
pnpm types                                   # tsc --noEmit
pnpm lint / pnpm lint:fix
pnpm fetch-refs                              # 97 docs into _refs/
pnpm validate                                # all packs
pnpm validate --pack <product>/<version>     # one pack
pnpm validate --pack <product>/<version> --root content/_test
pnpm detect-releases                         # JSON to stdout
pnpm generate --product <slug> --version <v> [--commit | --test]
pnpm generate --product <slug> --version <v> --dry-run
pnpm seed-fixtures                           # latest release of each product into _test/
```

---

## What's left to do

Listed in priority order; tackle top-down.

### 1. v2 four-agent pipeline redesign — TOP PRIORITY (planning §6.4.3)

**Will's call as of 2026-04-30:** the single-prompt v1 path is too much for one model pass — quality drifts across the four conceptual slices of a release pack (announcement channels, announcement personal, article channels, article personal). v2 splits generation into four focused sequential agents.

**Full design lives in `planning.md` §6.4.3.** Migration plan summary:

1. - [x] **Write four new prompts** under `prompts/agents/` (2026-04-30):
   - `release-channels.md` — agent 1, produces `channels/{linkedin,x,github-discussion,reddit}.md` + top-level `meta.json`
   - `release-personal.md` — agent 2, reads channels, produces `personal/<member>/<channel>.md` per opted-in pair
   - `article-channels.md` — agent 3, decides 0–3 angles, produces `articles/<slug>/{meta.json,channels/*.md}`
   - `article-personal.md` — agent 4, produces `articles/<slug>/personal/<member>/<channel>.md`
2. - [x] **Refactor `scripts/generate-content.ts`** (2026-04-30): `runNanocoder` extracted; `runAgentPipeline(job)` loops the four agents with per-agent retry (default bumped to **5 retries** at Will's call — `--max-retries 6` = 1 initial + 5 retries; cost ceiling 4 × 6 = 24 spawns). Per-agent failure writes `final_status: "failed-validation"` + `failed_agent: "<slug>"` in meta and aborts subsequent agents — earlier agents' output preserved on disk.
3. - [x] **Add `--phase` to `scripts/validate-content.ts`** (2026-04-30): phases `channels`, `personal`, `articles`, `personal-articles` plus `full` (default, used by Layer 2 PR check + seed-fixtures). Per-file rules apply uniformly.
4. - [ ] **Test locally end-to-end** with `pnpm generate --product nanocoder --version 1.25.2 --test`. Output should be at least as good as v1 single-shot. **← Will's verification step (needs API key).** A 1.25.0 test run already exists at `content/_test/nanocoder/1.25.0/` from a partial earlier run.
5. - [ ] **Delete `prompts/release-pack.md` and the v1 code path** once v2 is verified. Keep `prompts/auto-fix.md` (still used per-agent for retries — the `{{ORIGINAL_PROMPT}}` embed varies per agent). v1 prompt currently sits next to `prompts/agents/` as reference; nothing in the orchestrator wires it.
6. - [ ] **Update planning §6.4 / §6.4.3** to mark v2 as live and v1 as historical.

The v1 prompt stays in place during migration; the orchestrator already runs v2 only. A `git revert` is the rollback if A/B regresses.

**Length caps relaxed (2026-04-30, mid-implementation tick):** LinkedIn `max_words` 250 → 500, GitHub Discussion 1500 → 3000, Reddit 600 → 1500 in `config/channels.json`. Prompt guidance changed from "aim near the middle of the range" → "write what the substance warrants up to the cap; don't anchor to the middle." Triggered by Will reviewing the v1.25.0 plan-mode-two-phase article LinkedIn post and flagging it as compressed. See `docs/implementation.md` decision log.

Cost ceiling: 4 agents × 6 attempts = up to 24 spawns per pack. Wall time worst case 16–30 min; typical case much lower since most agents pass on attempt 1.

### 2. Operational unblock (gates the v1 pipeline shipping content while v2 is being built)

These are GitHub-level toggles or one-time fills that someone with admin rights to the Nano-Collective org needs to perform.

- [x] **Allow GitHub Actions to create and approve PRs.** As of 2026-04-30 this is locked at the org level. Path: `https://github.com/organizations/Nano-Collective/settings/actions` → Workflow permissions → enable both "Read and write permissions" and "Allow GitHub Actions to create and approve pull requests". Without this, `gh pr create` in `daily-content.yaml` fails and the workflow exits 1 (by design — see decision log).
- [ ] **Populate `config/team.json` voice notes.** The skeleton ships with TODO placeholders for Will's LinkedIn + X voice notes. Will has voice rules in another repo to import. The agent uses these to flavour `personal/will/{linkedin,x}.md`.
- [x] **First clean CI-driven PR.** Once the perms toggle is on, dispatch `daily-content.yaml` with `product=nanocoder version=1.25.2 dry_run=false`. Expected outcome: 4 channel files + 2 personal files (will/linkedin, will/x) + 0 articles (1.25.2 is a docs-only patch — agent should produce zero articles, which is correct). Validator may emit `min-words` warnings (soft, won't block merge).
- [ ] **Backfill the other three products** via `workflow_dispatch` once Nanocoder is happy:
  - `nanotune` (whatever its latest tag is — check `pnpm detect-releases`)
  - `get-md`
  - `json-up`
  Each opens its own PR. Review and merge.
- [x] **Decide whether to keep the cron enabled.** It's currently on at 08:00 UTC daily. Comment out `schedule:` in `daily-content.yaml` if you want manual-only for now.

### 3. Homepage redesign (the visible front-end story) — DONE 2026-04-30

✓ Done. `pages/index.tsx` is a thin orchestrator. New `components/home/Hero.tsx` mirrors the website pattern: full-bleed three.js / ASCII shader (`components/EffectScene.tsx` + `components/AsciiEffect.tsx` copied verbatim from `../website`, video at `public/video/cat-in-city.mp4`), badge + heading + paragraph (with `animate-on-scroll` + `animate-delay-*` classes already in `globals.css`), Browse-packs / Repo CTAs. ContentForest-themed copy: "Release content for the Nano Collective. Browse, copy, post." Product grid extracted to `components/home/ProductGrid.tsx` with `card-hover-glow` re-enabled. Three.js deps pinned to website versions (`@react-three/fiber@9`, `@react-three/drei@10`, `@react-three/postprocessing@3`, `three@0.183`).

Still on the table for a follow-up pass: swap the `cat-in-city.mp4` video for a forest-themed motif if Will wants to lean into the ContentForest naming. The hero machinery is asset-agnostic — drop a new file at `public/video/cat-in-city.mp4` (or rename + update `EffectScene.tsx`) and it picks up automatically.

**Original brief (kept for context):**

Today the homepage at `pages/index.tsx` is a plain card grid of products. **Will wants it to mirror the main Nano Collective website** (`../website`) — a proper hero, animated three.js shader, the same visual identity.

What to copy from `../website`:
- **Hero pattern** — see `../website/components/home/` (HeroSection or equivalent). The website uses a layered hero with a tagline, sub-tagline, social proof, and a 3D effect.
- **Three.js shader / animated video** — the website has `EffectScene.tsx` and `AsciiEffect.tsx` using `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`. Either drop one of those in directly or commission a new shader that's content-themed (an animated tree / forest motif would fit "ContentForest").
- **Visual rhythm** — section breaks, gradient backgrounds (`.animated-gradient` already exists in `globals.css` — Everforest-tinted, ready to use), card glow on hover (`.card-hover-glow` likewise).
- **Nav adjustments** — currently the Navbar is bare-bones (brand + theme toggle + sign-out). Consider adding: a subtle "Latest releases" dropdown surfacing recent packs. **Don't** add public-marketing links — this is an internal tool.

What to keep specific to ContentForest:
- The hero text should reflect the tool's purpose: "Release content for the Nano Collective. Browse, copy, post." or similar — operational, understated, per the brand voice.
- Below the hero, retain the product grid (or re-style it as a "Latest packs" timeline).
- Cloudflare Access still gates everything, so this is a member-facing landing page, not a public marketing page.

Deps already installed: `lucide-react`, `react-icons`. **Three.js deps need adding** if we go with shader: `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `three`. Match the versions in `../website/package.json` for consistency.

Suggested file split:
```
pages/index.tsx                 ← thin orchestrator
components/home/
  Hero.tsx                      ← text + three.js scene container
  ProductGrid.tsx               ← extract current logic
  EffectScene.tsx               ← copy from ../website (or new)
```

### 4. Show the signed-in user in the UI (lightweight GitHub identity) — DONE 2026-04-30

✓ Done. `hooks/useIdentity.ts` fetches `/cdn-cgi/access/get-identity` on mount and returns `loading` / `anonymous` / `identified`. `Navbar.tsx` renders an `IdentityBadge` (GitHub avatar from `https://github.com/<login>.png` + display name; title attr carries name + email + login for SR users) when `identified`, falls back gracefully to no badge on local dev (where the endpoint 404s).

**Logout fix shipped same day:** the per-app `/cdn-cgi/access/logout` path 404s on Cloudflare Pages static-export sites because Pages serves its 404 before Access intercepts. Fix: derive the canonical team-domain logout URL from the `iss` field in the get-identity response (`https://<team>.cloudflareaccess.com/cdn-cgi/access/logout`) — `logoutUrlFor()` in `hooks/useIdentity.ts`. Sign-out button is hidden when there's no identity (local dev).

**Original brief (kept for context):**

Cloudflare Access already authenticates everyone — but the app itself has no idea who's logged in. Will wants this surfaced (avatar, name, GH username).

Two clean approaches:

- **Cloudflare Access identity endpoint.** Every Access-protected page can `fetch('/cdn-cgi/access/get-identity')` from the client and get back a JSON object with the authenticated user's email, name, and (if the GH IdP returned it) `github_login`. The Navbar can call this on mount, cache in state, and render `<Avatar/Name/Sign out>` on the right. No server needed; works with the static export. **This is the recommended path.**
- **OAuth in-app via NextAuth** — explicitly rejected during planning (§5) because static export + NextAuth don't compose. Don't go down this road.

Implementation sketch (Cloudflare path):
```ts
// hooks/useIdentity.ts
type Identity = { name?: string; email?: string; github_login?: string; ... };
export function useIdentity(): Identity | null {
  const [i, setI] = useState<Identity | null>(null);
  useEffect(() => {
    fetch('/cdn-cgi/access/get-identity')
      .then(r => r.ok ? r.json() : null)
      .then(setI)
      .catch(() => setI(null));
  }, []);
  return i;
}
```

Then `Navbar.tsx` renders avatar (Octocat + `github_login`) when present, falls back to current Sign-out-only state when not. Locally (not behind Access) the endpoint 404s and we render a "Local dev" badge or nothing.

### 5. Full docs

The repo today has `planning.md`, `implementation.md`, and this handoff. Per Nano Collective project conventions (`_refs/collective/projects/creating-a-new-project.md`) the canonical doc set should be:

- [ ] **`README.md` rewrite** — currently minimal. The canonical structure (per `_refs/collective/organisation/brand.md` "README opening"):
  1. Title and one-liner.
  2. Canonical Nano Collective tagline (verbatim from the brand doc).
  3. Status badges — *skip for ContentForest* (internal tool, not on a registry).
  4. Quick start — "this is private, sign in at the URL". For maintainers: how to dispatch a generation, how to review a PR.
  5. Documentation — links into `docs/`.
  6. Community — link to the collective Discord / docs.
- [ ] **`docs/runbook.md`** — operational. Cover:
  - Dispatching `daily-content.yaml` manually (with inputs).
  - Reading a `failed-validation` PR — where the report artifact lives, what each rule means, when to merge anyway.
  - Cleaning up stale state (dropped PRs, orphan branches: `gh api -X DELETE repos/Nano-Collective/contentforest/git/refs/heads/<branch>`).
  - What to do when fetch-refs fails (docs site down).
  - What to do when a real release lands but detect-releases misses it (manual dispatch with explicit `product`+`version`).
  - Rolling back a bad merge.
- [ ] **`docs/local-development.md`** — for prompt tuning:
  - `pnpm install`, `pnpm dev` for the front-end.
  - `pnpm fetch-refs && pnpm generate --product <slug> --version <v> --test` for the generation pipeline.
  - `pnpm validate --pack <slug>/<v> --root content/_test` to gate.
  - Editing `prompts/release-pack.md` and re-running — feedback loop is ~3–8 min per generation.
  - `NC_REPOS_DIR` env var for reusing local checkouts.
  - The `.env.local` → `.env` rename gotcha.
- [ ] **`docs/adding-a-product.md`** — the operator-facing version of `planning.md` §7.2. When a 5th NC product ships, document the steps to onboard.
- [ ] **`docs/index.md`** + **`docs/community.md`** — only if ContentForest's docs are going to be surfaced on `docs.nanocollective.org`. If not, skip.
- [ ] **`AGENTS.md` / `CLAUDE.md`** at repo root — for AI agents working in this repo. Most of the context is already in `planning.md` + `implementation.md`; this can be a one-pager that says "read those two and the latest decision log entries before editing".
- [ ] **`LICENSE.md`** — MIT, copyright "Nano Collective". One file, follow the pattern in `../website/LICENSE.md`.
- [ ] **`.github/pull_request_template.md`** — at minimum, a "describe the change" + "checklist" template. The website has one to mirror.
- [ ] **Issue templates** — likely skip for an internal tool. Add only if you start fielding bug reports.

### 6. Phase 3 — conditional and longer-tail work

These are legitimately deferrable; revisit when the conditions trigger.

- [ ] **`auto-fix.yml` workflow (Layer 3 of the auto-fix loop).** Trigger condition: >20% of release-pack PRs land with `failed-validation` over the first month of operation. If we hit that, build it. Pair with the `nanocollective-bot` GitHub App so we never introduce a PAT. Design specifics in `planning.md` §6.7.
- [ ] **`nanocollective-bot` GitHub App.** When (a) we ship Layer 3, or (b) `github-actions[bot]` becomes a real attribution problem, replace with a dedicated App. Currently bot commits and PRs are attributed to `github-actions[bot]` which is fine for now.
- [ ] **Delete `nano-coder/.github/workflows/generate-release-content.yml`.** Once ContentForest has shipped 4+ real release packs successfully, retire the old workflow in the nano-coder repo. It's been superseded.
- [ ] **Search inside the file viewer.** Out-of-scope at design time; revisit only if the team consistently asks for it.
- [ ] **Posting integrations.** Explicitly out of scope (planning §12). Don't build.

### 7. Polish (low-priority, do as you encounter them)

- [ ] **Tests for `validate-content.ts`.** It's pure logic with no integration; a few fixture-based unit tests would lock the rules in. Suggest `vitest` for consistency with most TS projects.
- [ ] **Article view UX.** Currently each article gets its own section under the file tree with `meta.title` as heading and `meta.focus` as subtitle. If articles get heavy use, consider per-article pages (`/p/<product>/<version>/articles/<slug>`) with their own URLs for shareability.
- [ ] **Latest-versions cache.** `pages/index.tsx` reads the filesystem at build time, which is fine. If product count grows past ~20 we may want incremental-static-regeneration or a manifest file. Not yet.

---

## How to verify everything is working

Run these in order, top-down:

```bash
# 1. Local dev server renders the existing seed pack
pnpm install
pnpm dev
# → http://localhost:3000  → /p/nanocoder/0.0.0 should show the sample

# 2. Validator passes against committed content
pnpm validate

# 3. Refs fetch works (live HTTP to docs site)
pnpm fetch-refs

# 4. Detect-releases reports current GH state for all 4 products
pnpm detect-releases

# 5. Dry-run an orchestration (no API calls)
pnpm generate --product nanocoder --version 1.25.2 --dry-run

# 6. Real local generation (requires .env with MINIMAX_API_KEY)
pnpm generate --product nanocoder --version 1.25.2 --test
# → produces content/_test/nanocoder/1.25.2/{channels, personal, articles?, meta.json}

# 7. Validate the test pack
pnpm validate --pack nanocoder/1.25.2 --root content/_test

# 8. Build for prod
pnpm build
# → dist/ contains the static export
```

In CI, success looks like: `daily-content.yaml` log shows Nanocoder reading refs + repo + writing files, validator emits `✓ All hard rules passed.`, and a PR opens with `auto-release` label (no `failed-validation`).

## Don'ts

A short list of things planning rejected after consideration. Save the next round.

- **Don't add NextAuth or in-app GitHub OAuth.** Static export + Access at the edge is the design. Surface identity via `/cdn-cgi/access/get-identity` instead.
- **Don't make `min_words` a hard rule.** It's a soft warning by design (planning §6.6, decision-log entry 2026-04-30) — minor patches don't have ≥N words of substance and padding produces filler.
- **Don't bring back `release.md` as a separate file.** `channels/github-discussion.md` is the canonical long-form (it's what gets pasted into the website's GH Discussions, which becomes the public blog post).
- **Don't introduce a PAT in Phase 2.** When Layer 3 happens, ship the GitHub App with it.
- **Don't reconnect Cloudflare Pages to Git** (planning + decision log). Direct Upload via the GH Action only — avoids double-deploys and PR-branch preview noise.
- **Don't post automatically.** Posting is manual, always (planning §14). The team copies content out and posts via official accounts.
- **Don't pad article counts.** 0 articles for a trivial patch is correct behaviour, not a failure.

## Where to look first when something breaks

| Symptom | First place to look |
|---|---|
| Workflow hangs at `attempt 1/3` | Did Nanocoder get a TTY? Check `script -qfec` invocation in `runNanocoder`. Trust prompt? Check `--trust-directory` is in the spawn argv (both TTY and pty paths). |
| `gh pr create` fails | The org-level "Allow Actions to create PRs" toggle. |
| Validator reports `file-exists` for files that should be there | Path-shape mismatch. Check `expectedFiles` in `validate-content.ts` vs what the agent produced. Most common: nested vs flat personal. |
| Cloudflare Pages bot comments on PRs | Pages project has a Git connection. Disconnect or restrict preview branches (decision log 2026-04-30). |
| `min-words` showing as a failure | Validator regression. It must be a `warnings.push`, not `failures.push`. |
| TypeScript fails on `_repos/<product>/...` files | `tsconfig.json` exclude list missing — re-add `_repos`, `_refs`, `content/_local`, `content/_test`. |

## Reference URLs

Production: `https://contentforest.nanocollective.org` (Cloudflare Access — `Nano-Collective` org members only)
Repo: `https://github.com/Nano-Collective/contentforest`
CI: `https://github.com/Nano-Collective/contentforest/actions`
Cloudflare Pages project: `contentforest` (Direct Upload, Nano Collective account)
GitHub OAuth App: `https://github.com/organizations/Nano-Collective/settings/applications` (private, used by Cloudflare Access)
