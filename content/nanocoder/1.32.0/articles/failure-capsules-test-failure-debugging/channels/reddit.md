---
product: nanocoder
version: "1.32.0"
channel: reddit
title: "How Nanocoder reads a 3000-line test log and hands the model only the failures"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 5202
---

We shipped something in Nanocoder v1.32.0 that came out of a specific annoyance, and I think the reasoning is more interesting than the feature.

## The annoyance

You ask the agent to run the tests. 83 tests, 2 fail. The runner prints about 3000 characters. `execute_bash` caps what it hands the model at 2000 characters and keeps the head and the tail, because build and test tooling puts the summary at the end.

That works fine for a passing build. For a failing test run it is exactly backwards. The progress lines are at the top, the summary is at the bottom, and the detail of each failure is in the middle. The middle is what gets cut.

So the model receives the setup noise and `Tests: 2 failed, 81 passed, 83 total`, with no idea what actually broke. Then it does what you would do: it guesses. Sometimes it reads the test file and works it out. Sometimes it re-runs the whole suite and hopes for a different cut.

## What we do instead

When a command exits non-zero and its output is over the cap, Nanocoder checks the output against the formats of Jest, Vitest, Mocha, AVA and `tsc`. If one matches, the model gets a "failure capsule" instead of the cut log:

```
EXIT_CODE: 1
FAILURE CAPSULE (jest): 2 failing. Distilled from 3514 characters of output; only the failures are kept.
Reproduce: npm test -- jest/auth.test.js -t 'refreshSession retries once on 401'
Re-ran it on its own: still fails (exit 1).

1) refreshSession › retries once on 401
   at jest/auth.test.js:7:35
   expect(received).toBe(expected) // Object.is equality
   Expected: 2
   Received: 1
Summary: Tests: 2 failed, 81 passed, 83 total
```

Each failure keeps its title, its location, the assertion message and the expected/received diff. Passing tests, stack frames and code frames are dropped. The diagnostic is capped at 8 lines per failure.

Parsing is deterministic. There is no model call in this path.

## The re-run, and why it is limited

The `Reproduce` line is the original command narrowed to the first failing test, with the runner's own name filter. We run it once and report one of four outcomes:

- still fails, so it reproduces on its own
- it passed, so the failure depends on other tests or is flaky
- no tests ran, inconclusive
- exited non-zero without reporting a failing test, inconclusive

That last distinction is the part I like most. A name filter that matches nothing runs zero tests and exits 0 under Jest, Vitest and Mocha, and AVA exits 1 when `--match` finds nothing. So exit code alone says nothing about what happened. We only say "still fails" when the re-run's own output reports a failing test, and only say "it passed" when it reports a passing one. Everything else is inconclusive. It is tempting to report inconclusive as a pass and let the model get on with it, but a wrong "it passed" sends it looking for a bug that is not there.

The limits on the re-run are deliberate and I would push back on relaxing any of them:

- Only a plain invocation of the runner that printed the output is narrowed. `jest`, `npx vitest run`, `pnpm exec mocha`, or a package script whose `package.json` body is itself a plain runner call. Pipes, `&&` chains, redirects and substitutions are left alone, so the re-run is always a subset of what already ran.
- The re-run never repeats a package script's `pre`/`post` hooks. Those are usually a build, a lint or a coverage upload, and re-running them behind your back is not acceptable. With npm we use `--ignore-scripts`, which skips only the hooks. pnpm and yarn handle that flag badly, so they get no automatic re-run at all.
- `!command` input gets the capsule but never the re-run. You typed that command, so nothing else runs on your behalf.
- Output that is short enough to pass whole, or that matches no known format, is unchanged. The capsule adds to the existing truncation path, it does not replace it.

## The bit I did not expect

Mocha does not print the test file. It is only in the stack, and the first project frame is often the code under test rather than the test that called it. Narrowing Mocha to `src/parser.js` runs no tests. So the file comes from the first stack frame that looks like a test file (`*.test.*`, `*.spec.*`, or under `test/`, `tests/`, `spec/`, `__tests__/`). When the error was thrown in the code under test, the capsule shows both where it was thrown and which test file ran it.

AVA has its own quirk: it prefixes test titles with the file's path segments, trimmed to whatever is needed to tell files apart, so the parser strips that prefix back off to get a usable `--match` value. AVA also treats `*` as a wildcard and a leading `!` as negation, so a title with either drops the name filter rather than producing a filter that means something else.

There is more in the source. The parsers and the narrowing rules are in `source/tools/bash-failure-capsule.ts`, with the test fixtures being real output captured from a failing suite with output piped, the way `execute_bash` runs it.

Repo, issues and changelog: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
