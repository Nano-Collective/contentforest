---
product: nanocoder
version: "1.32.0"
channel: linkedin
title: "How Nanocoder reads a 3000-line test log and hands the model only the failures"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 1964
---

Ask an agent to run the test suite. 83 tests, 2 fail. The runner prints 3000 characters: progress at the top, the detail of both failures in the middle, a summary at the bottom. `execute_bash` caps what reaches the model at 2000 characters and keeps the head and the tail.

For a failing test run, the actionable part is in the middle. So the model gets the setup noise and `Tests: 2 failed, 81 passed`, and the assertion that matters was cut out of the log. It then guesses.

Nanocoder v1.32.0 handles this with a failure capsule. When a command exits non-zero and the output is over the cap, Nanocoder checks it against the output formats of Jest, Vitest, Mocha, AVA and `tsc`. If one matches, the model gets a capsule instead of the cut log. Each failing test keeps its title, location, assertion and expected/received diff. Passing tests, stack frames and code frames are dropped.

The capsule also carries a `Reproduce` line: the original command narrowed to the first failing test, with the runner's own name filter (`-t` for Jest and Vitest, `--grep` for Mocha, `--match` for AVA). Nanocoder runs that once and reports one of four outcomes: still fails, it passed (so the failure depends on other tests or is flaky), no tests ran (inconclusive), or exited non-zero without reporting a failing test (inconclusive).

The limits are deliberate. Only a plain invocation of the runner that printed the output is narrowed, so pipes, `&&` chains, redirects and substitutions are left alone. The re-run never repeats a package script's pre/post hooks. `!command` input gets the capsule but never the re-run, because you typed that command.

No model call is involved in parsing. The outcomes are fixed words, not a summary the same model would then have to trust while fixing the test.

Repo and changelog: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective - a community collective building AI tooling not for profit, but for the community.
