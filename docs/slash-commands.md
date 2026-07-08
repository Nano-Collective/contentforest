---
title: ContentForest — Slash Commands
status: live
owner: Will Lamerton
---

# Slash Commands

Two slash commands in the ContentForest pipeline. Both are issue/PR-comment triggers — the workflow filter looks at the comment body, dispatches the matching agent, and replies to the issue or PR with the outcome.

| Command | Where | Purpose |
| --- | --- | --- |
| [`/retry`](#retry) | On the **issue** that requested generation | Re-run the agent with the same request body. Used when the first run failed validation, errored, or the requester edited the issue. |
| [`/change <text>`](#change-text) | On the **PR** that the agent opened | Re-run the agent against the existing PR branch with `<text>` as a change request. Used to iterate on content without closing and re-opening. |

Neither command works without context: `/retry` only fires on issues that already have a `*-request` label; `/change` only fires on PRs whose branch matches one of the four shapes the parser knows.

---

## `/retry`

Re-runs the request agent against the **same issue body**. The original branch (if any) is deleted, the parser re-extracts the issue-form fields, the orchestrator spawns the agent fresh, and a new PR is opened.

### Where it works

| Issue label | Workflow | Agent that re-runs |
| --- | --- | --- |
| `release-request` | `.github/workflows/release-request.yaml` | `pnpm parse-release-request` + `pnpm generate` |
| `collective-request` | `.github/workflows/collective-request.yaml` | `pnpm collective-request` |
| `change-request` | `.github/workflows/change-request.yaml` | `pnpm change-request` |
| `personal-request` | `.github/workflows/personal-request.yaml` | `pnpm personal-request` |

It does **not** fire on:

- Issues without one of those labels (incl. random issues, bug reports, etc.).
- PRs — `/retry` is for re-running *generation*; the PR-comment equivalent is `/change`.

### How to use

1. Open the issue.
2. Edit the issue body if you want to refine the request first (the parser reads the body, not the comment).
3. Add a new comment whose body **starts with** `/retry`.
4. The workflow fires, marks the issue `processing`, deletes the previous attempt's branch, runs the agent, opens a fresh PR.

Anything after `/retry` in the comment is ignored — the request comes from the issue body, not the comment. So `/retry please be tighter this time` works the same as `/retry`. If you want to add a directive at runtime, use `/change` on the resulting PR instead.

### Examples

```
/retry
```

```
/retry  (rewrote the request body to be more specific)
```

### What it doesn't do

- It doesn't reset labels or close PRs from prior attempts. If the previous attempt opened a `failed-change` PR, that PR stays open until you close it manually. The orphan branch deletion only handles branches that don't yet have a PR; once a PR exists, the next `/retry` will fail to push because the branch already has commits and history. In practice: close the failed PR before `/retry`-ing.
- It doesn't re-fetch reference docs unless the workflow runs `pnpm fetch-refs` (it does, every run).

---

## `/change <text>`

Re-runs the agent **against the open PR's branch** with `<text>` as a change request. The agent reads what's already on the branch, applies your change with the smallest possible diff, and pushes a new commit on top. No new PR is opened.

### Where it works

`/change` listens on PR comments and dispatches based on the PR's **branch shape**. Wired in `.github/workflows/pr-change.yaml`:

| Branch shape | Dispatched to | What it edits |
| --- | --- | --- |
| `collective/<slug>-issue-<n>` | `pnpm collective-request` (whole-pack scope) | The collective pack at `content/_collective/<slug>/` |
| `change/<product>-<version>-issue-<n>` | `pnpm change-request` (whole-pack scope) | The product pack at `content/<product>/<version>/` |
| `release/<product>-<version>-issue-<n>` | `pnpm change-request` (whole-pack scope) | The product pack at `content/<product>/<version>/` (release-request PRs) |
| `personal/<member>-<pack-id-flat>-issue-<n>` | `pnpm personal-request` (edit mode) | The personal pack at `<base-pack>/personal/<member>/` |

It does **not** fire on:

- Forks — the workflow's `GITHUB_TOKEN` can't push to a fork. `/change` posts an explanatory comment and exits.
- Closed PRs — `/change` only works on open PRs.
- Comments that don't start with `/change ` (note the trailing space — `/change` with no body or `/changes` won't match).
- Issues — `/change` is for PRs only. The issue-side equivalent is `/retry`.
- PRs whose branch shape doesn't match any of the four above — the parser posts a "couldn't identify a content pack" comment and exits.

### How to use

1. Open the PR.
2. Add a comment whose body **starts with** `/change ` (literal — including the space) followed by your change request.
3. The workflow fires, checks out the PR branch, runs the agent in edit mode, validates, and either:
   - **Success** → commits the diff, pushes to the PR branch, replies `✅ /change applied as <sha>`.
   - **Failure** → no push (the PR branch is never touched on a failed run), replies `❌ /change ... <validator failures>`.

The comment text after `/change ` is the *change request* fed to the agent. Be specific. The agent treats it as a non-negotiable directive.

### Examples

Targeted change:

```
/change Tighten the LinkedIn post — drop the closing CTA, keep the lede.
```

Reword a specific line:

```
/change The opening line "Why write it yourself when your agents can handle it?" is lazy. Reword it — the actual point is that automating this saves time so the team can focus on the mission.
```

Multi-channel:

```
/change Make every channel post mention "Nanocoder 1.25.0" by name in the first line. Right now only the LinkedIn post does.
```

### What it doesn't do

- It doesn't queue. Two `/change` comments in quick succession serialise via concurrency group `pr-change-<PR>` — the second one waits for the first to finish.
- It doesn't change scope. The agent runs at whole-pack scope; if your request only affects one file, you rely on the prompt's "smallest diff" instructions to keep other files untouched. (For personal packs, the edit-mode prompt is more aggressive about scoping; for product/collective, the orchestrator's standard whole-pack prompt is in effect.)
- It doesn't undo a previous `/change`. To roll back, either edit the PR branch directly or close the PR and re-open from the original issue with `/retry`.

### When `/change` is the wrong tool

- **You want to start over** → close the PR, `/retry` the original issue.
- **You want a different angle entirely** (different release, different member, different scope) → open a new request issue.
- **The change is purely cosmetic and you can do it in one line** → just edit the file in the PR and push. Don't burn a Nanocoder spawn on a typo fix.

---

## Caveats

- **Org membership gate** — both commands require the commenter to be a public Nano Collective org member. The gate posts a comment if rejected. If you're a member, set your org membership to public at `https://github.com/orgs/Nano-Collective/people`.
- **Labels must exist** — `/retry` depends on the issue having the right `*-request` label, which depends on the label existing in the repo. Bootstrap is one-time: see runbook for the `gh label create` commands.
- **Workflow files resolve from `main`** — `issue_comment` events read the workflow file from the default branch at the time the event fires, not from the PR or issue branch. A change to `pr-change.yaml` in a feature branch doesn't take effect until merged to main.
