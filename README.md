# ContentForest

Internal Nano Collective tool. Live at `contentforest.nanocollective.org`. Members of the `Nano-Collective` GitHub org are gated in via Cloudflare Access; everyone else gets blocked at the edge.

A daily GitHub Action checks every Nano Collective product repo for new releases, generates a content pack via Nanocoder in non-interactive mode (release announcement + per-channel social posts + per-team-member personal-account variants), and opens a PR. Merging the PR triggers a Cloudflare Pages rebuild and the pack appears in the file viewer.

See [`docs/planning.md`](./docs/planning.md) for the full design and [`docs/implementation.md`](./docs/implementation.md) for build progress.

## Local development

```bash
pnpm install
pnpm dev
```

The dev server reads from `content/` on disk. To exercise the UI without a real generation run, the repo ships with a hand-authored sample at `content/nanocoder/0.0.0/`.

## Build

```bash
pnpm build
```

Outputs a static site to `dist/` (Next.js `output: "export"`). Cloudflare Pages serves this directly.
