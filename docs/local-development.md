---
title: ContentForest — Local Development
status: live
owner: Will Lamerton
---

# ContentForest — Local Development

How to run ContentForest locally — both the front-end (the file viewer) and the generation pipeline (Nanocoder + the validator + prompt tuning).

## Prerequisites

- **Node 20+** and **pnpm**.
- **Nanocoder** on `PATH`. CI builds it from main; locally you can either `npm install -g @nanocollective/nanocoder` (latest published) or clone, build, and link the [`Nano-Collective/nanocoder`](https://github.com/Nano-Collective/nanocoder) repo for tip-of-main:
  ```bash
  git clone https://github.com/Nano-Collective/nanocoder ~/Documents/GitHub/nano-collective/nano-coder
  cd ~/Documents/GitHub/nano-collective/nano-coder
  npm install && npm run build && npm link
  ```
- **`gh` CLI** authenticated (`gh auth login`) — `scripts/generate-content.ts` uses it to fetch GitHub release bodies.
- **`MINIMAX_API_KEY`** in `.env` at the repo root. The provider is configured in `agents.config.json`; the orchestrator reads `.env` automatically via `tsx`.

  ```
  # .env
  MINIMAX_API_KEY=...
  ```

  Note: the file is `.env`, **not** `.env.local`. Nanocoder reads `.env` from the working directory.

## Front-end (the file viewer)

```bash
pnpm install
pnpm dev                    # http://localhost:3000
```

The dev server reads `content/` from disk via `lib/content.ts`. To exercise the UI without a real generation run, the repo ships with a hand-authored sample at `content/nanocoder/0.0.0/` that the validator skips (its `meta.json` has `final_status: "sample"`).

Standard pre-flight before pushing:

```bash
pnpm types                  # tsc --noEmit
pnpm lint                   # biome check (no auto-fix)
pnpm lint:fix               # biome check --write — pre-commit reflex
pnpm build                  # static export to dist/
```

## Generation pipeline (prompt tuning loop)

The fastest iteration loop for the prompts:

```bash
pnpm fetch-refs                                   # one-off: 97 docs into _refs/

pnpm generate --product nanocoder \
              --version 1.25.2 \
              --test                              # writes to content/_test/

pnpm validate --pack nanocoder/1.25.2 \
              --root content/_test                # gate the pack
```

A real generation takes 8–15 minutes typical (longer worst case — see `handoff.md` §1 for the cost ceiling). For a much faster iteration when all you're doing is editing the substituted prompt, use `--dry-run`:

```bash
pnpm generate --product nanocoder --version 1.25.2 --dry-run
```

This prints every agent's substituted prompt to stdout without invoking Nanocoder. Useful for sanity-checking variable substitution and prompt structure without burning API credit.

### Output modes

| Flag | Output location | Use it for |
| --- | --- | --- |
| (default) | `content/_local/<product>/<version>/` | Local iterations you don't want to commit. Gitignored. |
| `--test` | `content/_test/<product>/<version>/` | Same, separate tree. Used by `seed-fixtures` for bulk prompt-tuning runs. Gitignored. |
| `--commit` | `content/<product>/<version>/` | Real run that commits to the live tree. The CI workflow uses this. |

### Editing prompts

The two live agent prompts are at `prompts/agents/{release-channels,article-channels}.md`. Each is self-contained — duplication of the brand-voice / channel-rules sections across prompts is intentional (per the v2 design in `planning.md` §6.4.3). When tuning:

1. Edit the prompt.
2. `pnpm generate --product <slug> --version <v> --test` (full feedback loop, 8–15 min).
3. `pnpm validate --pack <slug>/<v> --root content/_test` to confirm the validator is happy.
4. Eyeball the output in `content/_test/<slug>/<v>/`, or load the dev server and navigate to `/p/<slug>/<v>/` to see it rendered.

For a multi-product sweep (regenerate the latest release of every product), use `pnpm seed-fixtures`. It wraps `generate --test` over each product and skips packs that are already seeded unless `--force`.

### Reusing local product checkouts

By default the orchestrator shallow-clones each product repo into `_repos/<product>/` per run. If you already have a checkout of the NC product repos (e.g. under `~/Documents/GitHub/nano-collective/`), point the orchestrator at it with `NC_REPOS_DIR`:

```
# .env
NC_REPOS_DIR=~/Documents/GitHub/nano-collective
```

The orchestrator looks for `<NC_REPOS_DIR>/<product>/`. If found it uses that checkout (you're responsible for `git checkout v<version>` first); otherwise it falls back to a fresh clone into `_repos/`.

## Validator-only iteration

If you're only changing `scripts/validate-content.ts` or `config/channels.json`:

```bash
pnpm validate                                    # all packs in content/
pnpm validate --pack nanocoder/1.25.2            # one pack
pnpm validate --pack nanocoder/1.25.2 \
              --root content/_test                # one pack in _test/
pnpm validate --pack nanocoder/1.25.2 \
              --phase channels                    # validate only the channels-phase contract
```

The phases are `channels` / `articles` / `full` (default). They're cumulative — `articles` is `channels` plus the article expectations, `full` is everything. Per-file rules (frontmatter, length, forbidden terms, link policy, placeholders) apply uniformly regardless of phase.

## Common gotchas

- **`.env` not `.env.local`.** `tsx` reads `.env`. If you copy from a Next.js project's `.env.local`, the orchestrator won't see your `MINIMAX_API_KEY`.
- **`pnpm` argument forwarding.** `pnpm generate --product X --version Y` works. `pnpm generate -- --product X --version Y` also works (the orchestrator's `parseArgs({ allowPositionals: true })` handles the literal `--`). If you see `Unknown option`, you've hit a script that doesn't allow positionals — open the script and add it.
- **`tsconfig.json` excludes are load-bearing.** `_repos`, `_refs`, `content/_local`, `content/_test` are all in the exclude list. The shallow-cloned product repos contain TS that references their own `@/*` paths and breaks `tsc --noEmit` if not excluded.
- **Nanocoder lazy build.** If you cloned Nanocoder yourself, the `prepare: husky` script doesn't auto-build on `git install`, so `npm install -g github:Nano-Collective/nanocoder` doesn't work. The clone-build-link path above is the working one.
