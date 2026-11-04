---
product: nanocoder
version: "1.32.0"
channel: linkedin
title: "Measuring an agent: the eval harness that scores a released tag, not your tree"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 2584
---

Nanocoder v1.32.0 shipped an agent evaluation harness under `benchmarks/agent/`. It is deliberately small, and it exists to answer one question properly: did that change to the agent loop make it better or worse?

Token counts cannot answer that. A run that finishes in 4000 tokens because it never found the right file looks cheaper than a run that takes 12000 tokens and gets the task right. So the harness scores pass/fail first, and reports steps, tokens and cost alongside, never instead.

It scores by shelling out to the built CLI with `nanocoder --plain --json run`, rather than importing the agent loop. That is the decision that makes it useful: because it talks to a CLI through a documented interface, it does not care which version produced it. Point `--cli` at an older tag's `dist/cli.js` and the same harness, the same fixtures and the same assertions score that tag. You are measuring a released tag, not your working tree.

Six vendored fixtures cover single-file edits, a failing test run, a rename across call sites, navigation, and a structural question. Each carries machine-checkable assertions: file contents before and after, a regex over the final answer, a whole-tree hash for read-only tasks, and a command like `node --test` that the harness runs itself. There is no model judging a model.

The part worth explaining is the distractor files. `single-file-edit` asks for `DEFAULT_TIMEOUT_MS` in `src/config.js`, and ships `src/legacy-config.js` and `src/http/retry.js` with two other constants set to the same number. The assertions require the first to change and the other two to stay put. `navigation-find-definition` ships a seat-quota file next to the real storage-quota file.

Those exist to catch the failure mode a token count misses: an agent working from degraded context still finishes, still answers, and may even use fewer tokens because it searched less. With a distractor in place it hits the wrong constant and fails an assertion instead of quietly finishing cheaper.

Every result is stamped with a dated `fixturePackId` and a content hash of the whole fixture set, so a fixture edit can never be mistaken for a change in the agent. The hash catches the edit that forgot to bump the id.

It needs real model calls and takes minutes per run, so it sits outside `test:all` rather than slowing the CI gate. It is Phase 0: a baseline, not a leaderboard position.

Repo and changelog: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective - a community collective building AI tooling not for profit, but for the community.
