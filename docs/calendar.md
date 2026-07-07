---
title: ContentForest — Content Calendar
status: live
owner: Will Lamerton
---

# Content Calendar

The calendar is the **scheduling** half of ContentForest. It generates nothing —
it reads content that's already been generated (release packs, the weekly X
batch, the backlog of unused posts) and decides **what to post on which day**,
so a content marketer can open one view and see exactly what's due.

The guiding idea is a split that the rest of the pipeline doesn't make:
**generation is separate from scheduling.** Packs are still generated the same
way; a new layer — the *planner* — places references to that content onto
calendar days. The calendar page renders the result.

- **Planner:** `scripts/plan-calendar.ts` (`pnpm plan-calendar`)
- **Ledgers:** `content/_calendar/<monday>.json` (one per ISO week)
- **UI:** `/calendar` (month grid), `/calendar/<YYYY-MM>`, `/calendar/week/<monday>`
- **Workflows:** `.github/workflows/calendar-plan.yaml`, `.github/workflows/x-daily.yaml`

## Scheduling rules

| # | Rule |
| --- | --- |
| R1 | **Six X posts per weekday.** Monday–Friday only; weekends are never scheduled. |
| R2 | **At least one article per week** — an unused `github-discussion` deep-dive plus its supporting reddit/x/linkedin, drawn from the backlog. Runs regardless of whether there are releases. |
| R3 | **New-version announcements land promptly** — a release's top-level channel posts are slotted into the current week as soon as they're detected. |
| R4 | **≤1 release *set* per day.** If two products release, their announcements spread across separate days. |

A **release set is only the announcement** (a version's top-level
`channels/*.md`). A release's deep-dive **articles are backlog**, not part of the
release — they drip through R2 one per week. So once you've distributed a
release's announcement, that release is "done" and its articles simply flow into
the normal rotation.

### Reflow (what happens if you don't post something)

The planner is deterministic and idempotent — re-running it with the same
content and the same "today" produces the same schedule. Across days it
**reflows**:

- **Un-actioned (still unused) past posts** are dropped from the past day and
  slid forward onto the next weekday — the queue slides rather than stranding a
  miss. A missed Monday post shows up Tuesday, and keeps riding at the front
  until you post it or mark it won't-use.
- **Actioned past posts** (distributed / won't-use) stay put as the historical
  record of what actually happened.
- **Today and future** placements can move when a release arrives or an item is
  marked distributed/won't-use, but **already-distributed items and past days
  are never moved.**

Net effect: **past days show what you did; today and beyond show everything
still to post, misses included.**

## The ledger

One JSON file per ISO week at `content/_calendar/<monday>.json`. It's a derived
index — it *references* content by path and never contains it, so a post's
distribution status always lives in that file's own frontmatter
(`distributed_at` / `wont_use_at`), never duplicated here.

```jsonc
{
  "week_of": "2026-07-06",
  "generated_at": "2026-07-06T00:45:00Z",
  "days": {
    "2026-07-07": [
      { "slot": "github-discussion-1", "channel": "github-discussion",
        "type": "release", "release_set": "nanocoder@1.29.0",
        "ref": "content/nanocoder/1.29.0/channels/github-discussion.md" },
      { "slot": "x-1", "channel": "x", "type": "evergreen-x", "source": "get-md",
        "ref": "content/_x-daily/2026-07-06/posts/get-md-1.md" }
    ]
  }
}
```

- `type` is one of `release`, `backlog-article`, `evergreen-x`.
- `ref` resolves to a content `.md`; its status is read live when the page renders.
- Weekend days render in the grid but are always empty.

Validate a ledger with `pnpm validate --pack _calendar/<week>` (checks JSON
shape, `week_of` matches the filename, every day sits inside the week, item
shape, and R4). A `ref` whose file is missing is a warning, not a failure — the
planner prunes dangling refs on its next run.

## The weekly X batch

The evergreen X pool the planner fills R1 from. `scripts/x-daily.ts` generates a
**whole week in one run** — `--posts` slots (default **30 = 6/day × 5
weekdays**) round-robined across every product in `config/products.json` plus the
collective, so each product (including the newest) gets a fair, guaranteed share
each week. Output lands in `content/_x-daily/<monday>/`.

```bash
pnpm x-daily --date 2026-07-06 --test     # write to content/_test/
pnpm x-daily --date 2026-07-06 --commit   # write to content/ (the CI path)
pnpm x-daily --posts 30 --dry-run         # print the plan prompt, generate nothing
```

Each post is validated at write time by its own writer agent, and the whole
bucket is validated again after the batch with a per-slot fix loop (up to
`--max-retries`). `--date` should be the week's Monday; the cron passes it.

## Running it locally

```bash
pnpm fetch-refs                            # refresh _refs/ so writers have current docs
pnpm x-daily --date <monday> --commit      # generate the week's X pool (needs MINIMAX_API_KEY)
pnpm plan-calendar --commit                # place everything onto the calendar
pnpm dev                                   # view at http://localhost:3000/calendar
```

`plan-calendar` modes: `--commit` writes to `content/_calendar/`, `--test` to
`content/_test/_calendar/`, default (`--local`) to `content/_local/_calendar/`;
`--dry-run` prints the ledgers without writing. The **Mark distributed / won't
use** buttons call the distribute Worker, which is behind Cloudflare Access —
they don't work from a local dev server; viewing does.

## How it runs in CI

- **Weekly X batch** — `x-daily.yaml`, cron `15 0 * * 1` (Monday 00:15 UTC).
  Generates the 30-post batch and opens a PR for review. Merging it lets the
  planner schedule the posts.
- **Planner** — `calendar-plan.yaml`, daily cron `45 0 * * *` **and** on any push
  to `content/**` (excluding `content/_calendar/**`, so its own commit doesn't
  retrigger it). It runs `pnpm plan-calendar --commit`, validates every ledger,
  and **commits the ledgers straight to `main`** — they're a derived index, not
  reviewable content. That commit triggers a Cloudflare Pages rebuild, which is
  how the live calendar refreshes.

> **Direct push to `main`.** The planner pushes to `main` without a PR. If `main`
> is protected against direct pushes, either exempt `github-actions[bot]` or
> switch the last step of `calendar-plan.yaml` to open a PR instead.

## Backfilling after a change

After merging content changes (a new X batch, a release pack), the planner picks
them up on its next daily run or the next `content/**` push. To refresh the
calendar immediately, dispatch `calendar-plan.yaml` (**Run workflow**), or run
`pnpm plan-calendar --commit` locally and commit `content/_calendar/`.

## Relationship to the old weekly pack

This replaces the removed `weekly-pack` system. The weekly pack curated one
unused piece per channel into a static digest each Monday; the planner subsumes
that (its R2 backlog-article selection) and adds day-level scheduling, the X
pool, and prompt release handling. The `/w` routes and `scripts/weekly-pack.ts`
were removed.
