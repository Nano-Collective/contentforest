# ContentForest

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

ContentForest is the Nano Collective's release-content cockpit: a daily GitHub Action detects new releases across NC product repos, runs Nanocoder against a templated prompt to generate a complete content pack per release (announcement channel posts plus 0–3 deep-dive drip-articles), validates the output, and opens a PR. Merged PRs deploy to a Cloudflare-Pages-hosted file viewer at [`contentforest.nanocollective.org`](https://contentforest.nanocollective.org), gated by Cloudflare Access to `Nano-Collective` org members.

This is an **internal tool**. The site is private, and there is no install path — sign in at the URL above, or read the docs below if you maintain it.

## Quick start

### For team members

1. Sign in at [`contentforest.nanocollective.org`](https://contentforest.nanocollective.org) with your GitHub account (you must be a member of [`Nano-Collective`](https://github.com/Nano-Collective)).
2. Browse the latest packs from the homepage. Copy the channel posts you need and paste them into your social tool of choice — there is no automated posting (by design).

### For maintainers

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
- **[`docs/local-development.md`](./docs/local-development.md)** — local generation workflow for prompt tuning.
- **[`docs/adding-a-product.md`](./docs/adding-a-product.md)** — onboarding a new NC product.
- **[`AGENTS.md`](./AGENTS.md)** — orientation for AI agents working in this repo.

## Community

- **[Nano Collective](https://nanocollective.org)** — the collective behind this and every other NC project.
- **[Nano Collective docs](https://docs.nanocollective.org)** — the collective's shared operational reference (conventions, brand, project setup).
- **[GitHub organisation](https://github.com/Nano-Collective)** — every NC project, including this one.
- **[Discord](https://discord.gg/ktPDV6rekE)** — real-time chat with the collective.

## License

MIT. See [LICENSE.md](./LICENSE.md).
