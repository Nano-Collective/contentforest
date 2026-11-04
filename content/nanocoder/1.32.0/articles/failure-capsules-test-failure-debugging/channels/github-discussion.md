---
product: nanocoder
version: "1.32.0"
channel: github-discussion
title: "How Nanocoder reads a 3000-line test log and hands the model only the failures"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 10559
---

Here is a specific failure mode we kept hitting, and what v1.32.0 does about it.

You ask the agent to run the test suite. The suite has 83 tests. Two of them fail. The runner prints 3000-odd characters: progress lines at the top, the detail of both failures in the middle, and a summary at the bottom. `execute_bash` caps what it hands the model at 2000 characters, and keeps the head and the tail, because build and test tooling puts the actionable part at the end.

The problem is that for a failing test run, the actionable part is in the middle. So the model gets the setup noise and `Tests: 2 failed, 81 passed, 83 total`, and the assertion that actually matters has been cut out of the middle of the log. It then guesses, or re-runs the whole suite hoping for a different cut.

This is the failure capsule. When a command exits non-zero and its output is over the cap, Nanocoder checks it against the output formats of Jest, Vitest, Mocha, AVA and `tsc`. If one matches, the model gets a capsule instead of the cut log:

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

2) profile › renders the display name
   at jest/profile.test.js:4:42
   expect(received).toEqual(expected) // deep equality
   - Expected  - 1
   + Received  + 1
   Object {
   -   "name": "Ada Lovelace",
   +   "name": "Ada",
   "role": "admin",
   }
Summary: Tests: 2 failed, 81 passed, 83 total
```

Parsing is deterministic. There is no model call anywhere in this path.

## What survives the cut

Each failing test keeps four things: its title, its location, the assertion message, and the expected/received diff. Everything else goes:

- Passing tests are dropped.
- Stack frames are dropped.
- Code frames are dropped. The `>` caret line and the numbered source listing around the failing assertion are noise for the model, since it can read the file itself.
- Separators and blank lines go.

The diagnostic is capped at 8 lines, and each line is trimmed and clipped to 160 characters. The point of the capsule is not to reproduce the log. It is to say, for each failure, what broke and where.

The title is what the runner printed, so `refreshSession › retries once on 401` for Jest and `cart > applies the discount` for Vitest. Mocha is different: its title runs over several lines and ends with a colon, so the parser collects the header and the lines below it up to that colon, then joins them with spaces.

The location comes from the first stack frame that points into the project. Frames inside `node_modules` and Node internals (`node:...`) are skipped. Paths are made relative to the working directory when they are inside it, and always use forward slashes, because Windows runners print backslashes and every runner here accepts forward slashes on every platform.

`tsc` is a slightly different shape. There is no assertion and no diff, so each error is one line: the file, the line and column, the error code and the message. A compiler error is fully described by where it is and what it says.

## Narrowing the command

The capsule has a `Reproduce` line: the original command narrowed to the first failing test. For Jest and Vitest that is the test file plus `-t` with the test name. For Mocha it is `--grep`. For AVA it is `--match`. `tsc` has nothing narrower to re-run, so `Reproduce` is the original command.

The name filter is built from the title with the separator characters removed, so `refreshSession › retries once on 401` becomes `refreshSession retries once on 401`. Regex metacharacters in the name are escaped, and the argument is shell-quoted only when it needs it, so flags stay readable.

Two details that turned out to matter:

**The file the command already names is not repeated.** `npx jest jest/auth.test.js` narrowed to a failure in `jest/auth.test.js` becomes `npx jest jest/auth.test.js -t '...'`, not `npx jest jest/auth.test.js jest/auth.test.js -t '...'`.

**Mocha never prints the test file.** It only appears in the stack, and the first project frame is often the code under test rather than the test that called it. Narrowing Mocha to `src/parser.js` would run no tests at all. So the file is taken from the first stack frame that looks like a test file: `*.test.*`, `*.spec.*`, or a path under `test/`, `tests/`, `spec/` or `__tests__/`. When the error was thrown in the code under test, the capsule shows both: where it was thrown, and which test file ran it.

```
1) parser rejects empty input
   at mocha2/src/parser.js:3:16
   in mocha2/test/parser.test.js
   TypeError: Cannot read properties of undefined (reading 'length')
```

AVA has its own wrinkle. It prefixes each test title with the file's path segments, trimmed to whatever is needed to tell files apart. The parser strips the longest suffix of the file's segments that the title starts with, so the `--match` value is the test name on its own. AVA treats `*` as a wildcard and a leading `!` as negation, so a title containing either drops the name filter entirely rather than producing a filter that means something else.

## The re-run

The narrowed command is run once, under the same sandbox and same working directory as the original run. The point is to separate a real failure from a flaky or order-dependent one:

- **It still fails.** The failure reproduces on its own. The model can fix it.
- **It passed.** The failure depends on other tests, or it is flaky. The model now knows the test is not broken in isolation, which is a different bug to look for.
- **Inconclusive.** It ran no tests, or it exited non-zero without reporting a failing test.

The inconclusive case is the one worth being precise about, because it is easy to get wrong. A name filter that matches nothing runs zero tests and exits 0 under Jest, Vitest and Mocha. So exit code alone tells you nothing. `still fails` is only reported when the re-run's own output actually reports a failing test. `it passed` is only reported when the re-run's own output reports a passing test. Anything else is reported as inconclusive, never as a pass or a failure.

So there are four outcomes, and the model is told which one it is:

```
Re-ran it on its own: still fails (exit 1).
Re-ran it on its own: it passed, so the failure depends on other tests or is flaky.
Re-ran it on its own: no tests ran, so the result is inconclusive.
Re-ran it on its own: exited 1 without reporting a failing test, so the result is inconclusive.
```

AVA is the runner that makes the third line matter: AVA exits 1 when `--match` finds nothing, so a non-zero exit there is not a failure. It falls into the fourth line.

If the re-run could not finish at all, the capsule says so (`could not finish (...)`), and if the re-run was skipped entirely, there is no `Re-ran` line at all.

## The limits

This is the part that decides whether the feature is a good idea, so it is worth being explicit about what the re-run is not allowed to do.

**It only narrows a plain invocation of the runner that printed the output.** The command has to be `jest`, `npx vitest run`, `pnpm exec mocha`, `bunx ava`, a path to the binary, or a package script whose `package.json` body is itself a plain runner call. Anything with pipes, `&&` chains, `;`, redirects, command substitution or backticks is left alone, and so is a command with unbalanced quotes. The re-run is always a subset of what the original command already ran, and the re-run can only ever be the runner whose output was parsed. A Jest log does not get re-run with Mocha.

**It never repeats a package script's pre/post hooks.** `npm test` runs `pretest` and `posttest`, which are often a build, a lint or a coverage upload. Running those again behind the user's back is not acceptable. Where a script has such hooks, npm re-runs it with `--ignore-scripts`, which under npm 7+ skips only the hooks and still runs the named script. pnpm rejects the flag on `run`, and yarn 1 ignores it, so with hooks present pnpm, yarn and bun get no automatic re-run at all. A direct runner call was never going to run the hooks, so it is narrowed normally.

**`!command` input is distilled but never re-run.** When you type `!npm test` yourself, the capsule still appears, because the same log-truncation problem applies. But nothing runs on your behalf, because you typed the command.

**The capsule never invents a reproduce command.** If the command cannot be narrowed safely, `Reproduce` falls back to the original command and there is no re-run. The model gets the failures and can decide for itself what to run next.

**The capsule stays within the same 2000-character cap.** Whole failing tests are kept while they fit. When they stop fitting, the capsule says how many it left out (`+12 more failing (not shown)`) and the model can re-run for the rest. It does not silently drop the tail of the list.

**Unknown output is unchanged.** If the output matches none of the recognised formats, it goes through the ordinary head-and-tail truncation. The capsule is an addition to that path, not a replacement for it.

## Where this lives

The parsing and the narrowing are in `source/tools/bash-failure-capsule.ts`, with the fixtures in `bash-failure-capsule.spec.ts` being real output captured from a failing suite with output piped, the way `execute_bash` runs it. The hook into the bash path is `distillBashResultForLLM` in `source/tools/execute-bash.tsx`, which is what decides between the capsule and the ordinary truncation. The docs page for it is the tool output conventions page: https://github.com/Nano-Collective/nanocoder

One design note, since it is the kind of thing people ask about. The capsule is not a summary written by a model, and it is not a heuristic that tries to guess which lines matter. It is five parsers for five output formats, plus a set of rules about what may be re-run. That is why the outcome words are fixed: `still fails`, `it passed`, `inconclusive`. A model-written summary would be more flexible and less trustworthy, because the model that has to fix the test is the same one that would be reading its own guess about what went wrong.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
