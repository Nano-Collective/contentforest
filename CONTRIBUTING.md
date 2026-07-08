# Contributing to ContentForest

Thanks for your interest in ContentForest. We welcome contributions from developers of all skill levels — bug fixes, prompt tuning, validator improvements, UI tweaks, docs, all of it.

ContentForest is an internal Nano Collective tool: file an issue to request content and a GitHub Action runs Nanocoder against templated prompts to generate a release-content pack, validates the output, and opens a PR. Merged PRs deploy to a file viewer at [`contentforest.nanocollective.org`](https://contentforest.nanocollective.org). The repo is public for transparency; request flows and issues are intended for `Nano-Collective` org members.

This guide covers the dev setup, the test gate, and the divergences this project takes from the [Nano Collective playbook](https://docs.nanocollective.org/collective/projects/creating-a-new-project).

## Table of Contents

- [Getting Started](#getting-started)
- [Filing Requests via Issues](#filing-requests-via-issues)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Divergences from the Playbook](#divergences-from-the-playbook)
- [Submitting Changes](#submitting-changes)
- [Community](#community)

## Getting Started

Before contributing:

1. Read the [README](README.md) for what ContentForest does and how the pieces fit.
2. Read [`AGENTS.md`](AGENTS.md) if you're (or you're driving) an AI coding agent — it captures the don't-relitigate decisions and the agent-shaped guardrails.
3. Check the [issue tracker](https://github.com/Nano-Collective/contentforest/issues). Issues from non-`Nano-Collective` org members are auto-closed by `.github/workflows/gate-issues.yaml` — see [Divergences](#divergences-from-the-playbook) for why.

If you find an unassigned issue you'd like to work on, comment on it so we don't double up.

## Filing Requests via Issues

Most content changes don't need a code PR — they go through an issue template that dispatches an agent and opens a PR for you. The flows wired up today:

- **[Request new release content](https://github.com/Nano-Collective/contentforest/issues/new?template=release-request.yml)** (`release-request` label) — generate a full pack for a new product release. Pick the product (dropdown, auto-synced from `config/products.json`), enter the version (tag without the `v` prefix), and optionally add an angle to emphasise. The agent reads the product's GitHub release, generates the pack, validates it, and opens a PR off `release/<product>-<version>-issue-<n>` that auto-closes the issue on merge. Edit the issue body and comment `/retry` to re-run if the first attempt didn't land. Wired via [`scripts/parse-release-request.ts`](scripts/parse-release-request.ts) + `pnpm generate`.

- **[Request a content change](https://github.com/Nano-Collective/contentforest/issues/new?template=change-request.yml)** (`change-request` label) — apply a targeted edit to an existing release pack. Pick the product, version, scope (whole pack / headline channels / specific article / specific file), and describe the change. The agent applies the edit, runs the validator, and opens a PR that auto-closes the issue on merge. Comment `/retry` on the issue to re-run if the first attempt didn't land. Orchestrator: [`scripts/change-request.ts`](scripts/change-request.ts).

- **[Request a collective post](https://github.com/Nano-Collective/contentforest/issues/new?template=collective-request.yml)** (`collective-request` label) — create or edit a collective-level pack at `content/_collective/<slug>/` for posts about the Nano Collective itself rather than a specific product release. Same shape as change-request: fill the form, agent runs, PR opens. Orchestrator: [`scripts/collective-request.ts`](scripts/collective-request.ts).

Both flows are gated to `Nano-Collective` org members via [`gate-issues.yaml`](.github/workflows/gate-issues.yaml) — issues from non-members are auto-closed. If you're a member but your issue is auto-closed, set your org membership visibility to public at <https://github.com/orgs/Nano-Collective/people>.

For freeform bugs, feature ideas, or discussion, file a regular issue (no template needed) — those don't trigger automation.

## Development Setup

### Prerequisites

- Node.js 22 (matches CI; 20+ should also work)
- pnpm 10+
- Git

### Setup

```bash
git clone https://github.com/Nano-Collective/contentforest.git
cd contentforest
pnpm install
```

### Environment

Copy the `.env` keys you need from a maintainer. The minimum for local generation:

- `MINIMAX_API_KEY` — Nanocoder is wired to MiniMax Coding via `agents.config.json` (provider `minimax-m3`). Same secret CI uses.
- `GH_TOKEN` (or `GITHUB_TOKEN`) — needed for `pnpm detect-releases` against the live repos and for any flow that opens PRs locally.

For UI-only work, no env vars are needed.

### Common commands

```bash
pnpm dev                                   # Next.js dev server at http://localhost:3000
pnpm build                                 # static export to dist/
pnpm fetch-refs                            # pull live brand + product docs into _refs/
pnpm generate --product nanocoder \         # generate a pack into content/_local/
              --version 1.25.2 --test
pnpm validate --pack nanocoder/1.25.2 \     # gate locally before opening a PR
              --root content/_test
```

The full operator runbook is in [`docs/runbook.md`](docs/runbook.md). Local prompt-tuning workflow is in [`docs/local-development.md`](docs/local-development.md).

## Testing

### The single command

```bash
pnpm test:all
```

This runs the full gate — formatting check, type-check, lint, AVA tests, knip (dead-code detection), `pnpm audit`, and Semgrep — and is the same gate `pr-checks.yml` enforces on every PR. If it's green locally, your PR will be green.

If you don't have Semgrep installed locally, the orchestrator script logs a warning and skips it. In CI it always runs. Install with `brew install semgrep` or `pip install semgrep`.

### What's tested, and what isn't

- **`.ts` files** under `scripts/`, `lib/`, and `hooks/` are covered by AVA + c8 with an 80% line-coverage threshold.
- **`.tsx` UI components** are intentionally **not** covered. Coverage on Next.js UI is theatre and the testable logic lives in `scripts/`. Test UI changes with `pnpm dev` and exercise the affected route.
- **End-to-end generation** is not mocked. `scripts/generate-content.ts` calls Nanocoder and the result is non-deterministic. Test generation changes by running `pnpm generate --product <slug> --version <v> --test` and reading the output by eye.
- **Validator changes** must include regression tests in `scripts/validate-content.spec.ts`. The validator is the load-bearing piece; if it lets bad packs through, the GitHub Action opens broken PRs.

### Adding tests

Place specs alongside source with the `.spec.ts` extension (e.g. `scripts/parse-change-request.spec.ts`). Follow the patterns in `scripts/validate-content.spec.ts` — table-driven cases, no I/O against the real filesystem, no network.

## Coding Standards

- **TypeScript:** `strict: true`, ESNext, no `any` (warned by Biome).
- **Formatting and lint:** Biome handles both. Run `pnpm test:lint:fix` to auto-fix; CI runs `biome check` without auto-fix and fails on drift.
- **Path alias:** `@/*` resolves to the repo root (Next.js convention).
- **Error handling:** Validate at boundaries (user input, external APIs, generated content). Trust internal code.
- **Comments:** Default to none. Only add comments where the *why* is non-obvious — a hidden constraint, a workaround, behaviour that would surprise a reader. Don't explain *what* the code does.
- **No new dependencies** without a one-line justification in the PR description.

## Divergences from the Playbook

The [Creating a New Project](https://docs.nanocollective.org/collective/projects/creating-a-new-project) playbook describes the standard shape for an NC project. ContentForest takes the following deliberate divergences:

- **No NPM publish, no `release.yml`.** ContentForest is a private internal Next.js app, not a publishable package. `package.json` is `private: true`, version `0.0.0`. Deployment is via `.github/workflows/deploy-cloudflare-pages.yaml` on push to `main`, which uploads the static export to Cloudflare Pages.
- **Public repo, gated issues.** The repo is public for transparency, but issues are auto-closed for non-`Nano-Collective`-org members by `.github/workflows/gate-issues.yaml` (GitHub's native interaction limits expire after 6 months — this workflow is the permanent equivalent). If you're an NC member and your issue auto-closes, set your org membership visibility to public at <https://github.com/orgs/Nano-Collective/people>.
- **Path alias `@/*` → `./*`** instead of `@/*` → `source/*`. Next.js convention; the project doesn't use a `source/` folder.
- **No subagent spawning during generation.** `agents.config.json` blocks Nanocoder's `agent` tool via `nanocoder.disabledTools: ["agent"]`. Generation is a flat sequence of two prompts (`release-channels` → `article-channels`), not a spawning tree.
- **Coverage scope: `.ts` only.** UI `.tsx` components are excluded from c8 by design (see [Testing](#testing)).
- **No `docs/index.md` + frontmatter.** The repo's docs aren't surfaced on `docs.nanocollective.org`, so the docs-site convention doesn't apply. Operator docs live in `docs/runbook.md`, `docs/local-development.md`, and `docs/adding-a-product.md`.
- **No bug / feature issue templates.** The only templates that trigger automation are `change-request.yml` and `collective-request.yml`, which dispatch agents to apply targeted edits or create collective-level packs (see [Filing Requests via Issues](#filing-requests-via-issues)). Org members file freeform issues for bugs and features.

The [Code of Conduct](https://docs.nanocollective.org/collective/organisation/community) and [Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter) apply unchanged.

## Submitting Changes

1. Fork the repo (or branch directly if you're a maintainer).
2. Make your change. Run `pnpm test:all` and confirm it's clean.
3. Open a PR against `main`. The PR template asks for the testing notes and checklist — fill it in.
4. CI runs `pr-checks.yml` (parallel format / types / lint / tests / build / knip / audit / Semgrep). Content PRs additionally trigger `validate-content.yaml`.
5. A maintainer reviews and merges. Merging to `main` triggers the Cloudflare Pages deploy.

### Commit messages

Match the existing convention (light Conventional Commits):

- `feat: <description>` — new feature
- `fix: <description>` — bug fix
- `mod: <description>` — modification to existing behaviour
- `chore(deps): <description>` — dependency update
- `docs: <description>` — docs-only change
- Lowercase, imperative, no trailing period. Scope optional in parentheses.

## Community

- **[Nano Collective](https://nanocollective.org)** — the collective behind this and every other NC project.
- **[Discord](https://discord.gg/ktPDV6rekE)** — real-time chat with the collective.
- **[Code of Conduct](https://docs.nanocollective.org/collective/organisation/community#code-of-conduct)** — applies to all contributors.
- **[Economics Charter](https://docs.nanocollective.org/collective/organisation/economics-charter)** — how scoped bounties work when contribution is paid via the NC community fund.

Thanks for contributing.
