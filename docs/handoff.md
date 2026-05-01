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

### 1. v2 two-agent pipeline redesign — TOP PRIORITY (planning §6.4.3)

**Will's call as of 2026-04-30:** the single-prompt v1 path is too much for one model pass — quality drifts across slices of a release pack. v2 originally split generation into four focused sequential agents (channels + personal × release + articles); on 2026-05-01 Will collapsed it to **two agents** by dropping personal variants entirely. Generic release + article packs are sufficient; per-team-member voiced posts weren't pulling weight for the cost.

**Full design lives in `planning.md` §6.4.3.** Migration plan summary:

1. - [x] **Write the agent prompts** under `prompts/agents/` (2026-04-30; reduced from 4 to 2 on 2026-05-01):
   - `release-channels.md` — agent 1, produces `channels/{linkedin,x,github-discussion,reddit}.md` + top-level `meta.json`
   - `article-channels.md` — agent 2, decides 0–3 angles, produces `articles/<slug>/{meta.json,channels/*.md}`
2. - [x] **Refactor `scripts/generate-content.ts`** (2026-04-30): `runNanocoder` extracted; `runAgentPipeline(job)` loops the agents with per-agent retry (default bumped to **5 retries** at Will's call — `--max-retries 6` = 1 initial + 5 retries; cost ceiling **2 × 6 = 12 spawns** per pack after the personal-agent removal). Per-agent failure writes `final_status: "failed-validation"` + `failed_agent: "<slug>"` in meta and aborts subsequent agents — earlier agents' output preserved on disk.
3. - [x] **Add `--phase` to `scripts/validate-content.ts`** (2026-04-30; simplified 2026-05-01): phases now `channels`, `articles` plus `full` (default, used by Layer 2 PR check + seed-fixtures). Per-file rules apply uniformly to whatever .md files exist; legacy `personal/<member>/<channel>.md` files in older committed packs still parse cleanly but no longer appear in any expected-files list.
4. - [x] **In-spawn self-validation** added to both agent prompts (2026-05-01). Each agent runs `pnpm validate --pack <id> --root <root> --phase <its-phase> --report /tmp/cf-self-check.json --quiet` before declaring done, fixes flagged files, re-validates — capped at 3 in-spawn cycles. Halves typical-case spawn count since the model converges in one spawn instead of needing the orchestrator to fire a fresh retry.
5. - [x] **Test locally end-to-end** with `pnpm generate --product nanocoder --version 1.25.2 --test`. Output should be at least as good as v1 single-shot. **← Will's verification step (needs API key).** A partial 1.25.0 test run exists at `content/_test/nanocoder/1.25.0/` from an earlier four-agent attempt; if you want a clean A/B, delete that and re-run.
6. - [x] **Delete `prompts/release-pack.md` and the v1 code path** once v2 is verified. Keep `prompts/auto-fix.md` (still used per-agent for outer retries — the `{{ORIGINAL_PROMPT}}` embed varies per agent). v1 prompt sits next to `prompts/agents/` as reference; nothing in the orchestrator wires it. Note: the v1 prompt references `config/team.json`, which has been deleted — A/B'ing v1 cleanly would require putting it back temporarily.
7. - [ ] **Update planning §6.4 / §6.4.3** to mark v2 as live, v1 as historical, and reflect the two-agent shape (currently the planning doc still describes the four-agent design).

The v1 prompt stays in place; the orchestrator runs v2 only. A `git revert` is the rollback if A/B regresses.

**Length caps relaxed (2026-04-30):** LinkedIn `max_words` 250 → 500, GitHub Discussion 1500 → 3000, Reddit 600 → 1500 in `config/channels.json`. Prompt guidance changed from "aim near the middle of the range" → "write what the substance warrants up to the cap; don't anchor to the middle." Triggered by Will reviewing the v1.25.0 plan-mode-two-phase article LinkedIn post and flagging it as compressed. See `docs/implementation.md` decision log.

Cost ceiling: 2 agents × 6 attempts = up to 12 spawns per pack. Wall time worst case 8–15 min (typical case much lower with in-spawn self-validation reducing outer retries).

### 2. Operational unblock (gates the v1 pipeline shipping content while v2 is being built)

These are GitHub-level toggles or one-time fills that someone with admin rights to the Nano-Collective org needs to perform.

- [x] **Allow GitHub Actions to create and approve PRs.** As of 2026-04-30 this is locked at the org level. Path: `https://github.com/organizations/Nano-Collective/settings/actions` → Workflow permissions → enable both "Read and write permissions" and "Allow GitHub Actions to create and approve pull requests". Without this, `gh pr create` in `daily-content.yaml` fails and the workflow exits 1 (by design — see decision log).
- [x] **Populate `config/team.json` voice notes.** ~~Will needs to import voice rules from another repo.~~ **Obviated 2026-05-01** when the personal-variant agents were removed; `config/team.json` was deleted. Per-team-member voiced posts are no longer in scope.
- [x] **First clean CI-driven PR.** Once the perms toggle is on, dispatch `daily-content.yaml` with `product=nanocoder version=1.25.2 dry_run=false`. Expected outcome (v2 two-agent): 4 channel files + 0 articles (1.25.2 is a docs-only patch — agent should produce zero articles, which is correct). Validator may emit `min-words` warnings (soft, won't block merge).
- [ ] **Backfill the other three products** via `workflow_dispatch` once Nanocoder is happy:
  - `nanotune` (whatever its latest tag is — check `pnpm detect-releases`)
  - `get-md`
  - `json-up`
  Each opens its own PR. Review and merge.
- [x] **Decide whether to keep the cron enabled.** It's currently on at 08:00 UTC daily. Comment out `schedule:` in `daily-content.yaml` if you want manual-only for now.
- [x] **Restrict issue creation to NC org members** (the repo is public). Landed 2026-05-01 as `.github/workflows/gate-issues.yaml`. GitHub has no permanent native toggle for this — the workflow auto-closes any newly-opened issue from a non-public-NC-member with a comment pointing them at the right per-product issue trackers + Discord. **One operational requirement:** the gate uses the `public_members` API endpoint because the default `GITHUB_TOKEN` doesn't carry org-read scope, so org members must have their NC membership set to **public** at [github.com/orgs/Nano-Collective/people](https://github.com/orgs/Nano-Collective/people). The auto-close comment tells members how to flip it. Once the `nanocollective-bot` GH App lands (see §6), swap to using its token + the regular `members` endpoint and this constraint goes away.

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

### 5. Full docs — DONE 2026-05-01

✓ Done. The canonical NC doc set (per `_refs/collective/projects/creating-a-new-project.md`) is now in place:

- [x] **`README.md`** — rewritten 2026-05-01. Canonical NC tagline at the top, internal-tool framing, member quick-start + maintainer quick-start, links into `docs/`, community pointers.
- [x] **`docs/runbook.md`** — operational. Dispatching runs, reading `failed-validation` PRs (validator rule reference table), cleaning up stale state, fetch-refs / detect-releases recovery, rollback, `When something breaks` symptom → first-place-to-look table.
- [x] **`docs/local-development.md`** — prereqs, front-end loop, generation loop, output modes, prompt-editing iteration, `NC_REPOS_DIR` shortcut, validator-only iteration, common gotchas (the `.env` not `.env.local` thing, `pnpm` arg forwarding, tsconfig excludes, Nanocoder TTY requirement).
- [x] **`docs/adding-a-product.md`** — operator-facing version of `planning.md` §7.2. Pre-reqs (NC project, GH Release, docs page), `config/products.json` edit, optional channel-set override, backfill via workflow dispatch, sanity checks.
- [x] **`AGENTS.md`** — one-pager pointing at the three load-bearing docs in read order, plus a "things to avoid asking the user" section enumerating decided-and-shipped choices.
- [x] **`LICENSE.md`** — MIT, "Nano Collective", copy of the website's pattern verbatim.
- [x] **`.github/pull_request_template.md`** — description + type / testing / checklist sections, adapted from Nanocoder's pattern (no multi-provider matrix; ContentForest is one stack).
- [ ] **`docs/index.md`** + **`docs/community.md`** — skipped. ContentForest's docs aren't surfaced on `docs.nanocollective.org` (it's an internal tool); revisit only if that changes.
- [ ] **Issue templates** — skipped per the original guidance. The GitHub-issue-driven change-request feature in §6 will introduce a structured `change-request.yml` template when it ships; no need for a generic bug-report template until the team starts fielding them.

### 6. Phase 3 — conditional and longer-tail work

These are legitimately deferrable; revisit when the conditions trigger.

- [x] **GitHub-issue-driven "Request a change" — prompted edits to existing packs.** Landed 2026-05-01. The team can open a `Request a content change` issue (template at `.github/ISSUE_TEMPLATE/change-request.yml`), the `change-request.yaml` workflow parses the issue body into a job spec, runs the change-request agent against the existing pack, opens a PR with `Closes #<N>` in the body, and comments on the issue with the PR link. `/retry` issue comments re-run the workflow with the same fields.

  **What landed:**
  - `prompts/change-request.md` — change-request agent prompt (brand voice + channel rules + frontmatter contract duplicated from the v2 release prompts; scope discipline + self-check at `--phase full` capped at 3 cycles).
  - `scripts/parse-change-request.ts` — issue-form-body → job-spec JSON parser (stdin → stdout). Cross-field validation (e.g. scope=file requires file_path) fails the workflow before spawning Nanocoder. Smoke-tested manually with happy + missing-field + bogus-scope bodies.
  - `scripts/change-request.ts` — orchestrator. Resolves the pack (must exist), clones the product repo at the version for grounding, builds the prompt, runs Nanocoder with the auto-fix retry loop (default `--max-retries 3`), validates at `--phase full`, writes a `change-request.json` sidecar capturing requester / scope / request / outcome for audit on the PR diff.
  - `.github/ISSUE_TEMPLATE/change-request.yml` — issue form (product dropdown, version, scope, article_slug, file_path, request, context).
  - `.github/workflows/change-request.yaml` — triggers on `issues: opened, labeled` and `/retry` issue comments, filtered to the `change-request` label. Lifecycle labels: `processing` while running, `failed-change` if the agent exhausts retries (PR still opens). Concurrency group is per-issue so a `/retry` queues behind the in-flight run.
  - `pnpm change-request` and `pnpm parse-change-request` script entries.

  **Open questions / things to watch on first real use:**
  - Does the issue-form markdown shape match the parser's regex (`### <Field>` headings)? The parser is tolerant but GitHub may evolve the format.
  - Does Nanocoder reliably honour scope discipline? The prompt says "files outside scope must not change," but the agent could still touch them in yolo mode. The PR review is the safety net; if drift is common, gate the orchestrator on a per-scope file allow-list before pushing.
  - The `change-request.json` sidecar lands inside the pack directory and gets deployed with the rest of the static export. It's tiny (a few hundred bytes) and useful for audit; if it shows up unwanted in the file viewer, hide it in `lib/content.ts`.
  - Spam: org-gated by GitHub already. If a member opens many junk issues, gate the workflow on org membership via `gh api orgs/Nano-Collective/members/<user>` in the first step.

- [ ] **`auto-fix.yml` workflow (Layer 3 of the auto-fix loop).** Trigger condition: >20% of release-pack PRs land with `failed-validation` over the first month of operation. If we hit that, build it. Pair with the `nanocollective-bot` GitHub App so we never introduce a PAT. Design specifics in `planning.md` §6.7.
- [ ] **`nanocollective-bot` GitHub App.** When (a) we ship Layer 3, or (b) `github-actions[bot]` becomes a real attribution problem, replace with a dedicated App. Currently bot commits and PRs are attributed to `github-actions[bot]` which is fine for now.
- [ ] **Delete `nano-coder/.github/workflows/generate-release-content.yml`.** Once ContentForest has shipped 4+ real release packs successfully, retire the old workflow in the nano-coder repo. It's been superseded.
- [x] **Nanocoder upstream: top-level `disabledTools` in `agents.config.json`** — landed by Will 2026-05-01. Schema is `{ "nanocoder": { "disabledTools": ["agent", ...] } }`. ContentForest's `agents.config.json` now sets `disabledTools: ["agent"]` to drop the subagent-spawning tool from every spawn (config-level, not prompt-level — actually enforced by Nanocoder's tool manager, applies to both the main agent and any subagents per `nano-coder/source/subagents/subagent-executor.ts:213-214`). The previous prompt-level "do not use the `agent` tool" directives in both agent prompts have been removed.
- [ ] **Search inside the file viewer.** Out-of-scope at design time; revisit only if the team consistently asks for it.
- [ ] **Posting integrations.** Explicitly out of scope (planning §12). Don't build.

### 7. Polish (low-priority, do as you encounter them)

- [x] **Tests for `validate-content.ts`** — landed 2026-05-01. 26 ava tests at `scripts/validate-content.spec.ts` covering the happy paths for each phase, one test per failure rule the validator emits, the two soft-rule warnings, the `final_status: "sample"` skip, and the legacy `personal/<member>/<channel>.md` back-compat. Fixtures are built programmatically in `tmpdir` per-test (no on-disk fixture files committed). Refactored the validator to expose a programmatic `runValidate({ contentRoot, packFilter, phase, config })` entry alongside the CLI; `main()` only fires when the script is the process entry point. Test step wired into `validate-content.yaml` ahead of the existing pack-validation step.
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
