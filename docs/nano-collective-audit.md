# Nano Collective Conformance — Plan (Completed)

Trimmed conformance plan for `contentforest` against the Nano Collective project standards at <https://docs.nanocollective.org/llms.txt>:

- [Creating a New Project](https://docs.nanocollective.org/collective/projects/creating-a-new-project.md)
- [Stack Suggestions](https://docs.nanocollective.org/collective/projects/stack-suggestions.md)
- [Brand Guidelines](https://docs.nanocollective.org/collective/organisation/brand.md)

ContentForest is a public-but-internal Next.js app — gated by Cloudflare Access, not published to NPM, docs not surfaced on `docs.nanocollective.org`. Scope below reflects that: pick up the items that pay off for *us*, skip the items that only matter for external optics.

Snapshot: 2026-05-01. Branch: `main`. Canonical reference for the scripts/CI shape: `../nano-coder`.

**Status: all six steps landed in a single pass.** `pnpm test:all` runs format, types, lint, AVA + 80% coverage threshold, knip, audit, Semgrep — green end-to-end. Coverage on `.ts` files in `lib/` and `scripts/` lands at ~95%.

---

## Already done

- [x] `LICENSE.md` renamed to `LICENSE`.

## Plan

### 1. Fix the README and align it with the playbook

The README is mostly there — the issue is broken links to deleted docs.

- [x] Remove or redirect the three references to `docs/planning.md`, `docs/implementation.md`, `docs/handoff.md` (`README.md` lines 32–34). The remaining docs in the repo are `runbook.md`, `local-development.md`, `adding-a-product.md` — point at those instead, and add `CONTRIBUTING.md` to the list once it lands.
- [x] Same fix in `AGENTS.md` (lines 14, 19) and `.github/pull_request_template.md` line 26.
- [x] Confirm playbook section order is intact: H1 → canonical tagline → one-sentence description → Quick Start → Documentation → Community. Already correct apart from the broken links; no structural rewrite needed.
- [x] Add a top-level `nanocollective.org` link to the Community section (currently only present inside the tagline).

### 2. Add `CONTRIBUTING.md`

Mirror [Nanocoder's CONTRIBUTING.md](https://github.com/Nano-Collective/nanocoder/blob/main/CONTRIBUTING.md) as the structural reference. Cover:

- Welcome to contributors of all skill levels.
- Dev setup: clone, `pnpm install`, `pnpm dev`, env vars (`.env` keys we expect).
- Test gate: `pnpm test:all` runs format, types, lint, tests, knip, audit, semgrep.
- Coding standards: Biome rules, TS `strict: true`, path alias `@/*`.
- Defer to the [Code of Conduct](https://docs.nanocollective.org/collective/organisation/community) — link, don't restate.
- Defer to the [Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter) — link, don't restate.
- **Document the divergences** so contributors aren't surprised:
  - Internal app, `private: true`, no NPM publish, no `release.yml`. Deploy is via `deploy-cloudflare-pages.yaml`.
  - Path alias `@/*` → `./*` (Next.js convention) instead of `@/*` → `source/*`.
  - Public repo, but issues are gated by `gate-issues.yaml` to NC org members; app gated by Cloudflare Access.
  - No subagent spawning during generation (`agents.config.json` blocks the `agent` tool).
  - Coverage scope: `.ts` only — UI `.tsx` is excluded by design (see §3).

### 3. Wire up the recommended test surface (`test:all` + namespace)

Match `../nano-coder`'s shape. The canonical files to mirror:

- `nano-coder/package.json` `scripts` block (lines 34–58)
- `nano-coder/scripts/test.sh` — orchestrator with friendly logging and a Semgrep-installed-check
- `nano-coder/knip.json` — schema + ignores

Concretely for `contentforest`:

- [x] **Add devDependencies:** `c8`, `knip`. (`semgrep` is invoked via the binary, not an npm dep — the test script checks `command -v semgrep` and skips with a warning if missing, same as nanocoder.)
- [x] **Replace the `scripts` block in `package.json`** with the namespaced variant:
  - `test:all` → `./scripts/test.sh`
  - `test:ava` → `ava`
  - `test:ava:coverage` → `c8 ava`
  - `test:format` → `biome check --no-errors-on-unmatched .`
  - `test:types` → `tsc --noEmit`
  - `test:lint` → `biome lint .`
  - `test:lint:fix` → `biome check --write --unsafe .`
  - `test:knip` → `knip`
  - `test:audit` → `pnpm audit --audit-level=high --ignore-unfixable`
  - `test:security` → `semgrep scan --config auto --error`
  - Keep existing `dev`, `build`, `start`, `fetch-refs`, `validate`, `generate`, `detect-releases`, `seed-fixtures`, `change-request`, `parse-change-request`.
- [x] **Add `scripts/test.sh`** mirroring `nano-coder/scripts/test.sh` — `set -e`, run each `test:*` in sequence, the Semgrep `command -v` check at the end. Make it executable.
- [x] **Add `knip.json`** at the repo root. Starting ignores: `_refs/**`, `_repos/**`, `content/_local/**`, `content/_test/**`, `.next/**`, `dist/**`, `prompts/release-pack.md` (dead code, kept for A/B per AGENTS.md). The Next.js `pages/` and `app/` entries should be picked up by knip's Next.js plugin auto-detection.
- [x] **Update `pull_request_template.md`** testing checklist to call `pnpm test:all` instead of the current trio.

### 4. Coverage — `.ts` only, target 80% line threshold

User decision: coverage on UI components (`.tsx`) is theatre because they're hard to test deterministically and most of the testable logic lives in `scripts/`. Coverage should focus on `.ts` only — expected to land >90% naturally given the existing `validate-content.spec.ts`.

- [x] **`c8` config in `package.json`** mirroring nanocoder's pattern:
  ```json
  "c8": {
    "include": ["scripts/**/*.ts", "lib/**/*.ts", "hooks/**/*.ts"],
    "exclude": ["**/*.tsx", "**/*.spec.ts", "scripts/test.sh"],
    "reporter": ["text", "json-summary", "lcov"],
    "lines": 80,
    "functions": 0,
    "branches": 0,
    "statements": 0
  }
  ```
  (Adjust `include` to whatever directories actually contain `.ts` business logic. `pages/` and `components/` are .tsx-only so they fall out naturally.)
- [x] **Threshold** at 80% lines per the playbook — even though we expect >90%, leaving headroom prevents a single new untested helper from breaking the gate. Bump to 90% later once the surface stabilises.
- [x] **Write tests for the remaining `.ts` files in `scripts/`** that don't yet have specs: `change-request.ts`, `detect-releases.ts`, `fetch-refs.ts`, `generate-content.ts`, `parse-change-request.ts`, `seed-fixtures.ts`. (Currently only `validate-content.ts` has a `.spec.ts`.) Anything that calls the network or spawns Nanocoder gets a thin testable seam; don't end-to-end mock the agent itself.

### 5. Add Semgrep

For completeness, per the playbook's non-negotiable security-scan requirement.

- [x] `pnpm test:security` → `semgrep scan --config auto --error` (already covered in §3).
- [x] No npm dep; relies on the binary being on `PATH` locally and installed in CI.
- [x] In `pr-checks.yml` (next item), the Semgrep job uses [`returntocorp/semgrep-action`](https://github.com/returntocorp/semgrep-action) or the equivalent — see nanocoder's workflow for the canonical pattern.

### 6. Align `biome.json` with the playbook

Mirror [Nanocoder's `biome.json`](https://github.com/Nano-Collective/nanocoder/blob/main/biome.json). Two parts:

**Aesthetic (one-shot reformat):**

- [x] `formatter.indentStyle` → `tab`, `indentWidth` → 2 (currently `space`/2).
- [x] `formatter.lineWidth` → 80 (pin explicitly; matches current default).
- [x] `javascript.formatter.quoteStyle` → `single`, `jsxQuoteStyle` → `double` (currently `double` everywhere).
- [x] `javascript.formatter.semicolons` → `always`, `trailingCommas` → `all`, `bracketSpacing` → `false`, `arrowParentheses` → `asNeeded`.
- [x] Run `pnpm test:lint:fix` once the config is changed. Touches every TS/TSX file — keep this as its **own commit** so the diff is readable and doesn't muddy a feature change.

**Functional (lint rule severity):**

- [x] `linter.rules.correctness.noUnusedVariables` → `error`
- [x] `linter.rules.correctness.noUnusedImports` → `error`
- [x] `linter.rules.correctness.useExhaustiveDependencies` → `error`
- [x] `linter.rules.suspicious.noExplicitAny` → `warn`

The functional changes catch real bugs (dead vars, stale React deps, sneaky `any`s) — bigger payoff than the aesthetic pass on its own.

### 7. Add `pr-checks.yml`

The scripts above are only useful if they gate PRs. Mirror `nano-coder/.github/workflows/pr-checks.yml`:

- [x] Parallel jobs: `test:format`, `test:types`, `test:lint`, `test:ava:coverage` (with the 80% threshold check), `next build`, `test:knip`, `test:audit`, `test:security`.
- [x] Triggers: `pull_request` against `main`, plus `workflow_dispatch` for manual reruns.
- [x] Cache `node_modules` keyed on `pnpm-lock.yaml` to keep CI fast.
- [x] Concurrency group on `${{ github.ref }}` with `cancel-in-progress: true` so superseded pushes get cancelled.

---

## Explicitly skipped (so we don't relitigate)

- **Status badges + `update-badges.yml`.** Internal app, no external evaluation surface.
- **`release.yml` + NPM publish.** `private: true`, version `0.0.0`, deploy via Cloudflare Pages workflow.
- **Bug + feature issue templates.** Public repo gated by `gate-issues.yaml`; the only template that triggers automation is `change-request.yml`. Org members can file freeform issues.
- **`docs/index.md` + YAML frontmatter on existing docs.** Docs aren't surfaced on `docs.nanocollective.org` — the structure only matters when a docs site picks it up.
- **CodeQL.** Semgrep covers the realistic risk for a tool that calls Nanocoder + serves static files. Add later if Semgrep ever surfaces gaps.
- **Husky + lint-staged.** Nice-to-have, but `test:all` running locally + `pr-checks.yml` running in CI catches the same things. Add if review churn becomes a real problem.
- **Visual identity audit** (Poppins / Lora / Fira Code, Tokyo Night palette, NC logo placement). Design-judgement; do during a design pass, not as a conformance pass.

---

## Suggested execution order

Each step is independently mergeable and doesn't depend on the next:

1. **README + AGENTS.md + PR-template fix** (broken links). One-line PR.
2. **`CONTRIBUTING.md`** with the divergence notes.
3. **Biome alignment** — config change + reformat as a single isolated commit, then rule-severity overrides on top.
4. **Test-surface refactor** (`scripts` block, `scripts/test.sh`, `knip.json`, `c8` config, devDeps).
5. **Backfill `.ts` tests** under `scripts/` until coverage clears 80% (likely closer to 90%+ given the existing validator suite).
6. **`pr-checks.yml`** to gate the lot.

Doing Biome (3) before the test surface (4) means `pnpm test:format` lands green from day one. After step 6 the project is conformant against everything we care about for an internal tool.
