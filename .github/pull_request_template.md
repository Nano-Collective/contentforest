## Description

What this PR changes and why. One or two sentences is usually enough.

## Type of change

- [ ] Content (auto-generated release pack — `auto-release` label, validator passed)
- [ ] Content (auto-generated, validator failed — `failed-validation` label, needs human edit before merge)
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Refactor
- [ ] Docs / planning
- [ ] CI / infrastructure

## Testing

- [ ] `pnpm types` — clean
- [ ] `pnpm lint` — clean (biome check, no auto-fix)
- [ ] `pnpm build` — clean (static export)
- [ ] For UI changes: `pnpm dev` and manually exercised the affected route
- [ ] For generation changes: `pnpm generate --product <slug> --version <v> --test` produced a sensible pack
- [ ] For validator changes: `pnpm validate --pack <slug>/<v> --root content/_test` exits 0

## Checklist

- [ ] If this changes load-bearing design or behaviour, the relevant doc was updated (`docs/planning.md`, `docs/implementation.md` decision log, or `docs/handoff.md`).
- [ ] If this changes the generation pipeline, `prompts/agents/*.md` and the orchestrator (`scripts/generate-content.ts`) are still in sync.
- [ ] No secrets in the diff (`.env`, API keys, tokens).
- [ ] No new dependencies without a one-line justification in the PR description.
