# AGENTS.md

Orientation for AI coding agents (Nanocoder, Claude Code, Cursor, etc.) working in this repository.

## What this project is

ContentForest is an internal Nano Collective tool that:

1. Detects new releases across NC product repos (Nanocoder, Nanotune, get-md, json-up).
2. Runs Nanocoder in non-interactive `run` mode (`--mode yolo`, pty-wrapped) with a templated prompt to generate a release-content pack.
3. Validates the output and opens a PR per pack to `main`.
4. Serves the merged packs at `contentforest.nanocollective.org` behind Cloudflare Access.

The generation pipeline is **two sequential agents** (since 2026-05-01): `release-channels` produces the announcement channel posts, then `article-channels` produces 0–3 deep-dive drip articles. Each agent has its own retry budget, its own validator phase, and an in-spawn self-validation step. The live agent prompts are under `prompts/agents/`; the orchestrator is `scripts/generate-content.ts`.

Two issue-driven side flows sit alongside the release pipeline:

- **Change-request** edits an existing release pack (per product/version) on demand. Trigger: the `change-request` issue template plus the `change-request` label. Orchestrator: `scripts/change-request.ts`. Prompt: `prompts/change-request.md`.
- **Collective-request** creates or edits a product-independent collective-level pack at `content/_collective/<slug>/` — content about the Nano Collective itself, not a product release. Trigger: the `collective-request` issue template plus the `collective-request` label. Orchestrator: `scripts/collective-request.ts`. Prompt: `prompts/collective-request.md`. The validator handles `_collective/<slug>` packs alongside product packs (different frontmatter shape, link policy points to nanocollective.org).

## Conventions worth following

- **Pre-flight before claiming done:** `pnpm test:all`. Runs format, types, lint, AVA, knip, audit, Semgrep — same gate that `pr-checks.yml` runs in CI. `pnpm test:lint:fix` is the pre-commit reflex if formatting drifts.
- **Keep the operator docs honest.** When you change behaviour that affects operators (dispatching runs, reading failed-validation PRs, onboarding a new product), update `docs/runbook.md` / `docs/local-development.md` / `docs/adding-a-product.md` in the same PR. Don't let the docs drift from the code.
- **Memory** — the user's `MEMORY.md` (in their Claude project state) holds project-shaped feedback (e.g. "favour generous length caps", "no personal-variant agents in v2"). Honour those preferences without needing to re-relitigate them.
- **The v1 prompt (`prompts/release-pack.md`) is dead code** kept around for an A/B comparison Will hasn't run yet. Don't touch it. Don't wire it into anything. The live agents are under `prompts/agents/`.
- **`config/team.json` is deleted** — personal-variant agents were removed on 2026-05-01. Don't re-introduce it without checking with Will.
- **`config/products.json` is the source of truth** for NC product slugs and repo names. Real GH repo names are `nanocoder`, `nanotune`, `get-md`, `json-up` (no hyphen in `nanocoder`).
- **Don't add NextAuth, an OAuth flow, or any in-app GitHub auth.** Cloudflare Access at the edge is the design (`docs/handoff.md` §4 / planning §5).

## Things to avoid asking the user

These have been decided. Don't relitigate them:

- Posting integrations (out of scope — content is copy-paste by design).
- Bringing back `release.md` as a separate file (`channels/github-discussion.md` is the canonical long-form).
- Reconnecting Cloudflare Pages to Git (Direct Upload via the GH Action only).
- Subagent-spawning during generation (blocked at `agents.config.json` via `nanocoder.disabledTools: ["agent"]`).
