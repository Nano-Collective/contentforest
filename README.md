# ContentForest

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

ContentForest is the Nano Collective's release-content cockpit: a daily GitHub Action detects new releases across NC product repos, runs Nanocoder against a templated prompt to generate a complete content pack per release (announcement channel posts plus 0–3 deep-dive drip-articles), validates the output, and opens a PR. Merged PRs deploy to a Cloudflare-Pages-hosted file viewer at [`contentforest.nanocollective.org`](https://contentforest.nanocollective.org).

On top of that, a **content calendar** turns "what's been generated" into "what to post, and when". An automated planner schedules six X posts per weekday, at least one deep-dive article a week, and new-release announcements as they land — all viewable as a month/week calendar at `/calendar`, with distribute-tracking per post. See [`docs/calendar.md`](./docs/calendar.md).

This is an **internal tool** built for the Nano Collective. The repo is public for transparency; the deployed site, issue tracker, and request flows below are intended for `Nano-Collective` org members.

## Quick start

Open [`contentforest.nanocollective.org`](https://contentforest.nanocollective.org), browse the latest packs from the homepage, and copy the channel posts you need into your social tool of choice — there is no automated posting (by design).

## Requesting content or amends

You don't need to touch the repo or run anything locally to ask for a change. Two issue templates trigger an agent that does the work and opens a PR for review:

- **[Request a content change](https://github.com/Nano-Collective/contentforest/issues/new?template=change-request.yml)** — apply a targeted edit to an existing release pack. Fill in the product, version, scope (whole pack / headline channels / specific article / specific file), and the request itself. The agent applies the edit, runs the validator, and opens a PR that auto-closes the issue on merge. If the first attempt doesn't land cleanly, comment `/retry` to re-run.

- **[Request a collective post](https://github.com/Nano-Collective/contentforest/issues/new?template=collective-request.yml)** — create or edit a collective-level pack at `content/_collective/<slug>/`. Use this for posts about the Nano Collective itself rather than a product release (announcements, ecosystem updates, anything not tied to a single product version). Same shape as change-request: fill the form, the agent does the work, you get a PR.

Issues filed by non-org members are auto-closed by [`gate-issues.yaml`](.github/workflows/gate-issues.yaml) — see [CONTRIBUTING.md](./CONTRIBUTING.md) for why and how to surface your org membership if it isn't recognised.

## For maintainers

```bash
pnpm install
pnpm dev                                   # local UI at http://localhost:3000
pnpm fetch-refs                            # pull live brand + product docs into _refs/
pnpm generate --product nanocoder \         # generate a pack into content/_local/
              --version 1.25.2 --test
pnpm validate --pack nanocoder/1.25.2 \     # gate locally before opening a PR
              --root content/_test
```

For a real CI-driven generation, dispatch [`.github/workflows/daily-content.yaml`](.github/workflows/daily-content.yaml) with `product=<slug> version=<v> dry_run=false`. Full operator runbook in [`docs/runbook.md`](./docs/runbook.md).

## Documentation

- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — dev setup, test gate, coding standards, and the divergences from the [Nano Collective playbook](https://docs.nanocollective.org/collective/projects/creating-a-new-project) this repo takes.
- **[`docs/runbook.md`](./docs/runbook.md)** — dispatching runs, reading failed-validation PRs, recovering from broken state.
- **[`docs/calendar.md`](./docs/calendar.md)** — the content calendar: scheduling rules, the planner, the weekly X batch, and how it runs.
- **[`docs/local-development.md`](./docs/local-development.md)** — local generation workflow for prompt tuning.
- **[`docs/adding-a-product.md`](./docs/adding-a-product.md)** — onboarding a new NC product.
- **[`AGENTS.md`](./AGENTS.md)** — orientation for AI agents working in this repo.

## Community

- **[Nano Collective](https://nanocollective.org)** — the collective behind this and every other NC project.
- **[Nano Collective docs](https://docs.nanocollective.org)** — the collective's shared operational reference (conventions, brand, project setup).
- **[GitHub organisation](https://github.com/Nano-Collective)** — every NC project, including this one.
- **[Discord](https://discord.gg/ktPDV6rekE)** — real-time chat with the collective.

## License

MIT. See [LICENSE](./LICENSE).
