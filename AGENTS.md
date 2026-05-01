# AGENTS.md

Orientation for AI coding agents (Nanocoder, Claude Code, Cursor, etc.) working in this repository.

## What this project is

ContentForest is an internal Nano Collective tool that:

1. Detects new releases across NC product repos (Nanocoder, Nanotune, get-md, json-up).
2. Runs Nanocoder in non-interactive `run` mode (`--mode yolo`, pty-wrapped) with a templated prompt to generate a release-content pack.
3. Validates the output and opens a PR per pack to `main`.
4. Serves the merged packs at `contentforest.nanocollective.org` behind Cloudflare Access.

The generation pipeline is **two sequential agents** (since 2026-05-01): `release-channels` produces the announcement channel posts, then `article-channels` produces 0–3 deep-dive drip articles. Each agent has its own retry budget, its own validator phase, and an in-spawn self-validation step. See `docs/planning.md` §6.4.3 (with the 2026-05-01 banner) for the design and `docs/implementation.md` decision log for what's currently live.

## Conventions worth following

- **Pre-flight before claiming done:** `pnpm types && pnpm lint && pnpm build`. The CI runs `biome check` (no auto-fix) so any unsorted imports or formatting drift breaks the build — `pnpm lint:fix` is the pre-commit reflex.
- **Keep the three docs honest.** When you change a load-bearing piece of the design or operational behaviour, add a row to the `docs/implementation.md` decision log. When the migration plan in `docs/handoff.md` §1 advances a step, tick it. Don't let the docs drift from the code.
- **Memory** — the user's `MEMORY.md` (in their Claude project state) holds project-shaped feedback (e.g. "favour generous length caps", "no personal-variant agents in v2"). Honour those preferences without needing to re-relitigate them.
- **The v1 prompt (`prompts/release-pack.md`) is dead code** kept around for an A/B comparison Will hasn't run yet. Don't touch it. Don't wire it into anything. The live agents are under `prompts/agents/`.
- **`config/team.json` is deleted** — personal-variant agents were removed on 2026-05-01. Don't re-introduce it without checking with Will.
- **`config/products.json` is the source of truth** for NC product slugs and repo names. Real GH repo names are `nanocoder`, `nanotune`, `get-md`, `json-up` (no hyphen in `nanocoder`).
- **Don't add NextAuth, an OAuth flow, or any in-app GitHub auth.** Cloudflare Access at the edge is the design (`docs/handoff.md` §4 / planning §5).

## Things to avoid asking the user

These have been decided and live in the planning doc + decision log. Don't relitigate them:

- Posting integrations (out of scope, planning §14).
- `min_words` as a hard rule (it's a soft warning by design).
- Bringing back `release.md` as a separate file (`channels/github-discussion.md` is the canonical long-form).
- Reconnecting Cloudflare Pages to Git (Direct Upload via the GH Action only).
- Subagent-spawning during generation (blocked at `agents.config.json` via `nanocoder.disabledTools: ["agent"]`).
