---
product: nanocoder
version: "1.32.0"
channel: reddit
title: "Measuring an agent: the eval harness that scores a released tag, not your tree"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 9334
---

We shipped an agent evaluation harness in Nanocoder v1.32.0, under `benchmarks/agent/`. It's Phase 0 of an internal issue, and it's small. But the reasoning behind how it's built is the interesting part.

## Why it exists

The question we kept asking was: did that change to the agent loop make it better or worse? And a related one: is v1.32.0 actually better than v1.31.0, or did we just change the shape of the output?

Both are hard to answer with a token count. A run that finishes in 4000 tokens because it never found the right file looks cheaper than a run that takes 12000 tokens and gets the task done. Cheaper and wrong is not better, and a dashboard showing only tokens will happily tell you it is.

So pass/fail is the primary score. Steps, tokens and cost are reported alongside it, never instead of it.

## It shells out to the CLI

The harness doesn't import the agent loop. It runs the built CLI as a subprocess:

```bash
node <cli-path> --plain --json --trust-directory --mode yolo run "<prompt>"
```

`--plain --json` gives a machine-readable report on stdout and routes the human-readable output to stderr. The report carries the final text, the step count, the exit code, a `kind` (`success` / `error` / `tool-approval-required`) and provider-reported token usage.

Shelling out is the decision that makes the harness worth having. Since it talks to a CLI through a documented interface, it doesn't care which version produced the report. Point it at an older tag's `dist/cli.js` and the same harness, fixtures and assertions score that tag:

```bash
pnpm run test:agent-eval -- --cli ../nanocoder-1.31.0/dist/cli.js
```

That's what "scores a released tag, not your tree" means in practice. It also keeps the harness version-agnostic as the internals move around: it consumes only the public `--json` shape.

Two flags are deliberate. `--mode yolo` is the default, because an unattended run must never sit waiting for an approval prompt. `--trust-directory` is passed explicitly so the harness doesn't depend on the host's trust state.

## Six vendored fixtures

Each fixture is a directory with a small vendored project tree and a `task.json` holding the prompt and the assertions. They're vendored into the repo rather than cloned at test time, so a run is reproducible, works offline, and can't be moved by upstream drift.

The six tasks: change one constant in one file and nothing else; run the test suite and fix the source without touching the tests; make a JSON loader fall back to defaults on invalid input; rename an exported function and update every call site but leave the similarly named neighbour alone; find the file that decides whether an account is over its storage quota; and list every exported function in a directory that sends a notification.

The categories are `single-file-edit`, `multi-file`, `navigation` and `question`. Spanning more than one kind of work matters.

## Assertions, not a judge

Every fixture carries assertions the harness evaluates itself. No model judging a model.

Six kinds: `file-contains` and `file-not-contains` (a path's contents after the run), `final-text-matches` and `final-text-not-matches` (the model's answer, against a case-insensitive regex), `files-unchanged` (nothing written during a read-only task), and `command` (a command exits 0 in the workspace).

The `command` assertion is the strictest one. In the failing-test fixture it is literally `node --test`: the harness runs the suite itself after the agent is done, and the task only passes if it actually goes green. In another fixture it's `node scripts/verify.js`, a script the fixture ships that checks the valid path still parses and the broken path now falls back. The agent can't satisfy that by writing a summary of how it fixed the bug.

`files-unchanged` is what makes the read-only tasks real. The harness hashes the whole tree before and after, so a task that asks for an answer fails if a file moved, even when the answer was right.

A task only passes if all three hold: the CLI reports `kind: "success"`, it exits 0, and every assertion holds. An error or approval-required run keeps its measurements but counts as a failure, even if its partial edits satisfy the assertions. A crash is not a pass.

## The distractor files, which are the whole point

Here's the bit I would push back on anyone removing.

Each fixture ships files that look like the target but aren't. The single-file-edit fixture asks for `DEFAULT_TIMEOUT_MS` in `src/config.js`. The tree also has `src/legacy-config.js` with `LEGACY_TIMEOUT_MS = 3000` and `src/http/retry.js` with `RETRY_BACKOFF_MS = 3000`. Same number, three constants, and the assertions require the first to change and the other two to stay put.

The navigation fixture ships `src/billing/seat-quota.js` with `isOverSeatQuota` right next to the real `src/billing/storage-quota.js` with `isOverStorageQuota`, plus a `src/api/quota-handler.js` and a `docs/quotas.md` that both mention quotas. The structural-question fixture puts `formatAddress` and `isValidWebhookUrl` in the same directory as `sendEmail`, `sendWebhook` and `sendSlackMessage`, and uses `final-text-not-matches` to keep the helpers out.

Why go to that trouble? Because the failure mode worth catching is an agent working from degraded context. Context got truncated, a file didn't make it into the prompt, retrieval surfaced only part of the tree. The agent still finishes. It still produces an answer. It may use fewer tokens, because it did less searching.

A token count cannot catch that. It sees a cheaper run and calls it a win. An assertion can. The distractor is there so a run working from the wrong context hits the wrong constant or names the wrong file, and fails an assertion rather than quietly finishing cheaper. Then pass/fail does what the token count couldn't.

It's also why the negated assertion kinds exist separately. Asserting only on what should be there lets a run that changed too much pass.

## Stamping every result

Two fields exist so a change in the fixture set can never be read as a change in the agent:

- `fixturePackId`, a dated id for the fixture set, currently `agent-eval-2026-09-29`, bumped by hand when a fixture's tree, prompt or assertions change.
- `fixtureSetHash`, a content hash of the whole fixture directory, every file's path and bytes.

The id alone can be forgotten. The hash can't, because it's computed from the files. Edit a fixture and forget to bump the id, and the hash moves anyway, so the discrepancy shows up in the results file. Edit the agent and neither field moves. The results file also records the CLI path measured, the model, the provider and the runs per task, which together tell apart "the agent changed", "the fixtures changed" and "we swapped the model".

## Running it

```bash
pnpm run build                       # the harness measures dist/cli.js
pnpm run test:agent-eval             # every fixture, 5 runs each
pnpm run test:agent-eval -- --fixture single-file-edit --runs 1
pnpm run test:agent-eval -- --model qwen3:8b --provider ollama
pnpm run test:agent-eval -- --cli ../nanocoder-1.29.0/dist/cli.js
```

Five runs per task by default, because one run proves nothing. The same task on the same code can land differently depending on how the model sampled, so the harness reports the median and interquartile range for steps, tokens, cost and duration rather than hiding the spread behind an average.

Each run happens in a throwaway copy of the fixture tree in a temp directory, deleted afterwards. A task can edit freely and the vendored fixture is never touched.

## What it costs, and what it doesn't

It needs real model calls and takes minutes per run, so it sits **outside** `pnpm run test:all`, the fast gate that runs in CI. The boot and packaging benchmarks elsewhere under `benchmarks/` are separate and untouched.

The local tier is an Ollama model any contributor can reproduce. Pin the same model and temperature across the runs you're comparing: a pass rate measured against one model and compared against one measured against another isn't a comparison.

Cost is priced from the same usage module the agent uses, which prices provider-reported tokens through models.dev and bills cache reads and writes at their own rates. A local model has no published price, so its cost shows as an unpriced marker rather than `$0.00`. That's deliberate. "Not priced" and "free" are different claims.

## The honest limits

- It's Phase 0. Six fixtures is a baseline, not a benchmark suite, and the numbers shouldn't be quoted as a leaderboard position.
- It measures the CLI as a subprocess, so the harness only sees what the `--json` report exposes.
- A CLI older than the `steps` field is reported as unmeasurable rather than counted as a zero-step run. The step count is the measurement this harness exists for, so a report without it is an error, not a data point.
- Cost lookup is best-effort: an offline pricing lookup fails a cost lookup, not a run.
- In the local tier there's no price, so cost comparison there is impossible by construction. Use token counts.

Repo, issues and changelog: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
