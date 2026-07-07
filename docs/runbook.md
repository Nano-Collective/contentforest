---
title: ContentForest — Runbook
status: live
owner: Will Lamerton
---

# ContentForest — Runbook

Operational reference for the people who actually keep this thing running. If you're here because something broke, jump to **[When something breaks](#when-something-breaks)** at the bottom; it covers the common symptoms.

## Dispatching a generation manually

The daily cron at 08:00 UTC handles the routine case. For backfills, re-runs, or testing a specific release in CI, dispatch the workflow yourself:

1. Open [the daily-content workflow](https://github.com/Nano-Collective/contentforest/actions/workflows/daily-content.yaml).
2. Click **Run workflow**.
3. Inputs:
   - `product` — slug from `config/products.json` (e.g. `nanocoder`, `nanotune`, `get-md`, `json-up`).
   - `version` — the release tag without the `v` prefix (e.g. `1.25.2`).
   - `dry_run` — `true` writes to `content/_test/<product>/<version>/` and labels the PR `test`. `false` writes to `content/<product>/<version>/` and opens a real release PR.
4. Submit. The run takes 8–15 minutes typical, longer worst case (`docs/handoff.md` §1 has the cost ceiling).

The workflow opens **one PR per pack** with the `auto-release` label (and `failed-validation` if the hard rules failed). Review the diff, merge if it reads cleanly. The merge triggers a Cloudflare Pages rebuild and the pack appears at `/p/<product>/<version>/` on the live site within a minute.

**Idempotency guard:** the workflow skips packs whose `auto/release-<product>-<version>` branch already exists on origin. To re-run an already-attempted pack: delete the orphan branch first (`gh api -X DELETE repos/Nano-Collective/contentforest/git/refs/heads/auto/release-<product>-<version>`).

## Calendar planner & weekly X batch

Full reference in [`docs/calendar.md`](./calendar.md); the operational essentials:

- **Weekly X batch** ([`x-daily.yaml`](https://github.com/Nano-Collective/contentforest/actions/workflows/x-daily.yaml), cron `15 0 * * 1`, Monday 00:15 UTC) generates the week's 30-post evergreen X pool (6/day × 5 weekdays) and opens a PR. Review + merge like any content PR. To run for a specific week, **Run workflow** with `date=<that week's Monday>`.
- **Planner** ([`calendar-plan.yaml`](https://github.com/Nano-Collective/contentforest/actions/workflows/calendar-plan.yaml), daily cron `45 0 * * *` + on push to `content/**`) runs `pnpm plan-calendar --commit`, validates every ledger, and opens/force-updates a single **"Refresh content calendar" PR** off the `auto/calendar` branch. Merge it to land the ledgers on `main` and trigger a Pages rebuild; the live `/calendar` refreshes within a minute.

**One rolling PR:** the ledgers change daily, so the planner keeps a single force-updated PR (branch `auto/calendar`) rather than opening a new one each run. If you close it without merging, the next run reopens it. Review is a formality — it's a derived index.

**Backfill / force a refresh:** dispatch `calendar-plan.yaml` (**Run workflow**), or locally `pnpm plan-calendar --commit` and commit `content/_calendar/`.

**Weekend/weekday note:** the planner only schedules Monday–Friday. Empty weekend cells and a current-week Monday that's already in the past are expected, not a bug — unposted past items reflow forward onto the next weekday (see `docs/calendar.md` → Reflow).

## Reading a `failed-validation` PR

The PR opens with the `failed-validation` label when the validator's hard rules fail after the orchestrator's per-agent retry budget is exhausted. The pack is still pushed so a human can read what the agent produced and finish it.

1. Open the PR. The body summarises which agent failed (`failed_agent` field in `meta.json`).
2. Open the `validate-content` workflow run on the PR (Checks tab → `validate-content`).
3. Download the **`validation-report` artifact** — it's the structured `validation-report.json` listing every failure with `{file, rule, expected, actual}`.
4. Apply the fixes by hand in the PR's branch.
5. Push. The validator runs again automatically (Layer 2 PR check). When it goes green, merge.

### Validator rule reference

| Rule | What it means | Fix |
| --- | --- | --- |
| `meta-exists` / `meta-parses` | `meta.json` missing or invalid JSON | Re-write `meta.json` to the shape in `prompts/agents/release-channels.md`. |
| `file-exists` | A required channel or article file is missing | Write the file. Check the agent's prompt for the expected paths. |
| `frontmatter-shape` / `frontmatter-product` / `frontmatter-version` | Frontmatter missing fields, or `product` / `version` don't match the pack | Fix the frontmatter to match the pack's product + version. |
| `channel-known` | `frontmatter.channel` not in `config/channels.json` | Use one of `linkedin`, `x`, `github-discussion`, `reddit`. |
| `max-chars` | X post over 280 chars | Trim. |
| `max-words` | LinkedIn / Reddit / GH Discussion over the channel max | Restructure to be more concise; don't truncate mid-thought. |
| `forbidden-term` | Brand-doc forbidden phrase appeared (case-insensitive) | Re-read `_refs/collective/organisation/brand.md`, re-ground the wording. |
| `no-placeholder` | Unresolved `{{TODO}}` / `{{RELEASE_URL}}` / etc. | Replace the placeholder with real content. |
| `link-product-repo` | Body doesn't contain the product repo root URL | Add the repo URL at least once. |
| `link-not-release` | Body contains a `/releases/tag/` or `/releases/download/` URL | Replace with the repo root URL. |
| `articles-cap` | More than 3 articles | Delete the weakest article directory. |
| `article-slug-kebab-case` / `article-slug-matches` / `article-meta-shape` | Article structure issue | Rename the directory (kebab-case) or fix the article's `meta.json`. |

`min-words` shortfalls are hard failures — pad the body until it clears the floor, or lower `min_words` on the channel if the floor is wrong.

## Cleaning up stale state

### Orphan branches

The workflow deletes its own branches if PR creation fails or if the run produces no channel files (system failure). But if a branch persists after a failed run:

```bash
gh api -X DELETE repos/Nano-Collective/contentforest/git/refs/heads/auto/release-<product>-<version>
```

### Dropped PRs

If a PR was closed without merging and you want to re-run the same `<product>/<version>`, delete the branch (above), then re-dispatch the workflow.

### Stale `_local/` or `_test/` content

These directories are gitignored. To wipe them:

```bash
rm -rf content/_local content/_test
```

## When `fetch-refs` fails

`scripts/fetch-refs.ts` pulls from `https://docs.nanocollective.org/llms.txt` and every doc it lists. If the docs site is down or `llms.txt` 404s, the script fails loudly.

- **Verify the docs site:** `curl -I https://docs.nanocollective.org/llms.txt`. If it 404s, the docs site is the problem — file an issue against [`Nano-Collective/docs`](https://github.com/Nano-Collective/docs) and pause generation runs until it's up.
- **Partial outage** (one or two docs 404 but `llms.txt` is up): re-run with `pnpm fetch-refs --allow-partial`. The agent reads whatever made it into `_refs/`; missing brand or product docs may degrade output quality but won't crash the pipeline.

## When `detect-releases` misses a real release

`scripts/detect-releases.ts` diffs the live GitHub releases against `content/<product>/index.json`. It can miss a release if:

- The release was published as a plain git tag without a GitHub Release entry (no `body` to fetch).
- The product's `index.json` was manually bumped without a real generation run.
- GitHub's API is rate-limiting.

**Workaround:** dispatch `daily-content.yaml` manually with explicit `product=<slug> version=<v>` (see [Dispatching a generation manually](#dispatching-a-generation-manually)). The orchestrator does the right thing even when the release body is empty (it falls back gracefully).

## Rolling back a bad merge

If a release pack merges and the content reads badly:

1. **Easiest path:** open a follow-up PR that edits the files in place. Cloudflare Pages rebuilds on merge to `main`. No special procedure.
2. **Revert the merge commit:** `git revert <merge-sha>`, push to `main`, Pages rebuilds and the pack disappears from the file viewer.
3. **Surgical:** delete just the offending files (`rm content/<product>/<version>/channels/<file>.md`), commit, push. The file viewer reflects whatever's on disk.

There is no "unpublish" step beyond editing the source. Nothing is posted automatically (planning §14), so a bad pack never reaches an audience until a human copy-pastes it.

## When something breaks

Quick reference for the common symptoms:

| Symptom | First place to look |
| --- | --- |
| Workflow hangs at `attempt 1/N` | Did Nanocoder get a TTY? Check the `script -qfec` invocation in `runNanocoder` (`scripts/generate-content.ts`). Trust prompt? Confirm `--trust-directory` is in the spawn argv. |
| `gh pr create` fails | Org-level **"Allow Actions to create PRs"** toggle on `https://github.com/organizations/Nano-Collective/settings/actions`. |
| Validator reports `file-exists` for files you can see | Path-shape mismatch. Check the agent's prompt for the expected paths and the `expectedFiles` function in `scripts/validate-content.ts`. |
| Cloudflare Pages bot comments on PRs | Pages project has a Git connection. Disconnect or restrict preview branches. |
| `min-words` failure on a thin patch release | Either flesh the body out, or lower `min_words` for that channel in `config/channels.json` / `config/team.json` if the floor is genuinely wrong. |
| TypeScript fails on `_repos/<product>/...` files | `tsconfig.json` exclude list missing — re-add `_repos`, `_refs`, `content/_local`, `content/_test`. |
| Sign-out button missing on the live site | The `iss` field isn't in the get-identity response. Check the Access app's claims config. |
| Sign-out button 404s | The per-app `/cdn-cgi/access/logout` is being served by Pages's 404. The Navbar derives the team-domain logout from `iss` instead — confirm the user actually has an identity (the button is hidden when not). |
