---
product: nanocoder
version: "1.32.0"
channel: github-discussion
title: "Measuring an agent: the eval harness that scores a released tag, not your tree"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 12242
---

Nanocoder v1.32.0 added an agent evaluation harness under `benchmarks/agent/`. It is small, it is Phase 0 of an internal tracking issue, and it exists for one reason: so a change to the agent loop can be judged instead of argued about.

This is a walk through how it works, and why it is built the way it is.

```bash
npm install -g @nanocollective/nanocoder
```

Repo, issues and the full changelog: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

## The problem it solves

Two questions come up constantly on a project like this:

- Did that change to the agent loop make it better or worse?
- Is v1.32.0 actually better than v1.31.0, or did we just change the shape of the output?

Both are hard to answer without a measurement. Token counts alone will not do it. A run that completes in 4000 tokens because it never found the right file looks like an improvement on a run that takes 12000 tokens and gets the task right. Cheaper and wrong is not better.

So the harness scores two things at once: whether the task was actually done, and what it cost to do. Pass/fail comes first. Steps, tokens and cost are reported alongside, never instead.

## It shells out to the CLI, on purpose

The harness does not import the agent loop. It runs the built CLI as a subprocess:

```bash
node <cli-path> --plain --json --trust-directory --mode yolo run "<prompt>"
```

`--plain --json` gives it a machine-readable report on stdout with the human-readable output routed to stderr. The report carries the final text, the step count, the exit code, a `kind` of `success` / `error` / `tool-approval-required`, and provider-reported token usage.

Shelling out rather than importing is the decision that makes the whole thing useful. Because the harness talks to a CLI through a documented interface, it does not care which version produced it. Point it at a checkout of an older tag's `dist/cli.js` and the same harness, the same fixtures and the same assertions score that tag:

```bash
pnpm run test:agent-eval -- --cli ../nanocoder-1.31.0/dist/cli.js
```

That is the difference between measuring a released tag and measuring your working tree. It is also why the harness stays version-agnostic as Nanocoder's internals move around. The `--json` report shape is a public contract, and the harness consumes only that.

Two flags are worth noting. `--mode yolo` is the default, because an unattended run must never block waiting for an approval prompt. `--trust-directory` is passed explicitly, so the harness does not depend on whatever trust state the host machine happens to have.

## The fixtures are vendored, on purpose

Six task fixtures live under `benchmarks/agent/fixtures/`. Each one is a directory holding:

- a small vendored project tree
- a `task.json` with the prompt and the assertions
- the category it belongs to

They are vendored into the repository rather than cloned from somewhere at test time. That means a run is reproducible, works offline, and cannot be changed by upstream drift. If a task's expected answer changes, that is a diff in this repo, reviewable like any other.

The categories today are `single-file-edit`, `multi-file`, `navigation` and `question`. The suite deliberately spans more than one kind of work, because a benchmark that only measures one kind of work is not much of a baseline.

The six tasks:

| Fixture | What it asks for |
| --- | --- |
| `single-file-edit` | Change `DEFAULT_TIMEOUT_MS` in `src/config.js` to 5000, and change nothing else |
| `failing-test` | Run the test suite and fix the source so every test passes, without editing the tests |
| `guard-json-parse` | Make `loadConfig` return the default config on invalid JSON, then verify with `node scripts/verify.js` |
| `multi-file-rename` | Rename the exported `log` to `logInfo` and update every call site, but leave `logError` alone |
| `navigation-find-definition` | Name the file that decides whether an account is over its storage quota |
| `structural-question` | List every exported function in `src/notifiers/` that sends a notification |

## Assertions are machine-checkable, and they are the score

Every fixture carries assertions that the harness evaluates itself. There is no model judging a model, and no LLM-as-judge layer to trust.

There are six assertion kinds:

| Assertion | Checks |
| --- | --- |
| `file-contains` | A path's contents after the run |
| `file-not-contains` | A path's contents after the run, negated |
| `final-text-matches` | The model's answer, against a case-insensitive regex |
| `final-text-not-matches` | The model's answer, negated |
| `files-unchanged` | Nothing was written during a read-only task |
| `command` | A command exits 0 in the workspace |

`command` is the strictest one. In `failing-test`, the assertion is `node --test`: the harness runs the test suite itself after the agent is done, and the task only passes if the suite actually goes green. In `guard-json-parse`, it is `node scripts/verify.js`, a script the fixture ships that checks the happy path still parses and the broken path now falls back. The agent cannot satisfy that by asserting in prose that it fixed the bug.

`files-unchanged` is what makes the read-only tasks real. `navigation-find-definition` and `structural-question` ask for an answer and nothing else, and the harness hashes the whole tree before and after. If a file moved, the task fails even if the final answer was right.

A task passes only when all three of these hold: the CLI reports `kind: "success"`, the CLI exits 0, and every assertion holds. An error run or an approval-required run keeps its reported measurements but counts as a failure, even if its partial edits happen to satisfy the assertions. A crash is not a pass.

## The distractor files are the point

Here is the part that matters most, and it is easy to skip past.

Each fixture ships files that look like the target but are not. `single-file-edit` asks for `DEFAULT_TIMEOUT_MS` in `src/config.js`. The tree also contains `src/legacy-config.js` with `LEGACY_TIMEOUT_MS = 3000` and `src/http/retry.js` with `RETRY_BACKOFF_MS = 3000`. All three constants hold the same number. The task's assertions require the first to change and the other two to stay put.

`navigation-find-definition` ships `src/billing/seat-quota.js` with `isOverSeatQuota`, next to the real `src/billing/storage-quota.js` with `isOverStorageQuota`, plus a `src/api/quota-handler.js` and a `docs/quotas.md` that both mention quotas. `structural-question` puts `formatAddress` and `isValidWebhookUrl` in the same directory as `sendEmail`, `sendWebhook` and `sendSlackMessage`, and asserts with `final-text-not-matches` that the answer does not include the helpers.

Why? Because the failure mode this harness is built to catch is an agent working from degraded context. If the context window is truncated, or a file was left out of the prompt, or the retrieval step only surfaced part of the tree, the agent still finishes. It still produces an answer. It may even use fewer tokens, because it did less searching.

A token count cannot catch that. A token count sees a cheaper run and calls it a win. An assertion can. The distractor file is there so that a run working from the wrong context hits the wrong constant, or names the wrong file, and fails an assertion instead of quietly finishing cheaper. The pass/fail score then does what the token count cannot.

This is also why `file-not-contains` and `final-text-not-matches` exist as separate assertion kinds. Asserting only on what should be there lets a run that changed too much pass. The negatives close that off.

## Every result is stamped with what produced it

Two fields exist for one reason: so a change in the fixture set can never be read as a change in the agent.

- `fixturePackId` - a dated id for the vendored fixture set, currently `agent-eval-2026-09-29`. It is bumped by hand when a fixture's tree, prompt or assertions change.
- `fixtureSetHash` - a content hash of the entire fixture directory, every file's path and bytes.

The id alone can be forgotten. The hash cannot, because it is computed from the files themselves. If someone edits a fixture and forgets to bump the id, the hash changes and the discrepancy is visible in the results file. If someone edits the agent, neither field moves.

The results file also records the CLI path that was measured, the model and provider, and the number of runs per task. Together those are enough to tell apart "the agent changed", "the fixtures changed" and "we swapped the model".

## How it runs

```bash
pnpm run build                       # the harness measures dist/cli.js
pnpm run test:agent-eval             # every fixture, 5 runs each
pnpm run test:agent-eval -- --fixture single-file-edit --runs 1
pnpm run test:agent-eval -- --model qwen3:8b --provider ollama
pnpm run test:agent-eval -- --cli ../nanocoder-1.29.0/dist/cli.js
```

Five runs per task by default. One run proves nothing: the same task on the same code can land differently depending on how the model sampled. The harness reports the median and the interquartile range for steps, tokens, cost and duration, so the spread is visible rather than hidden behind an average.

Each run happens in a throwaway copy of the fixture tree, made in a temp directory and deleted afterwards. A task can edit freely, and the vendored fixture is never touched by a run.

One flag is worth calling out: `--cli <path>`. It is the reason a released tag can be measured with the same harness as the working tree. The default is this checkout's `dist/cli.js`.

## What it costs to run

It needs real model calls, and it takes minutes per run. It is deliberately **not** part of `pnpm run test:all`, which is the fast gate that runs in CI. The two suites are separate on purpose: the boot and packaging benchmarks under `benchmarks/` measure startup and packaging and are untouched by this.

The local tier is an Ollama model any contributor can reproduce, and the README asks you to pin the same model and temperature across the runs you are comparing. Pinning the model matters as much as pinning the code. A pass rate measured against one model and compared against a pass rate measured against another is not a comparison.

Cost is priced from the same usage module the agent itself uses, which prices provider-reported tokens through models.dev and bills cache reads and writes at their own rates. A local model has no published price, so its cost reads as an unpriced marker rather than `$0.00`. The distinction is deliberate: "not priced" and "free" are different claims, and the harness does not make the second one.

## The limits, stated plainly

- It is Phase 0. Six fixtures is a baseline, not a benchmark suite, and the numbers from it should not be quoted as a leaderboard position.
- It measures the CLI as a subprocess. That is deliberate, but it means the harness can only see what the `--json` report exposes.
- A CLI older than the `steps` field is reported as unmeasurable rather than counted as a zero-step run. The step count is the measurement this harness exists for, so a report without it is an error, not a data point.
- Cost lookup is best-effort. An offline pricing lookup fails a cost lookup, not a run.
- The local tier has no price, so cost comparisons in that tier are impossible by construction. Use token counts there.
- Assertion regexes come from the vendored `task.json` files, which are authored in-repo by the benchmark's maintainers, not from runtime user input.

## Where it goes next

Phase 0 gives you a way to measure. The next phases are about making the measurement worth trusting over time: more fixtures, a recorded baseline to compare against, and probably a way to run the suite against several CLI builds in one pass so a comparison is one command rather than two.

What we would like from people reading this: more fixtures. The suite's value is in the spread of work it covers, and one more task with good distractors is worth more than a better reporting layer.

Repo, issues and changelog: https://github.com/Nano-Collective/nanocoder
