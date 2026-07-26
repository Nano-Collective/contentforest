---
product: sentinel
version: "0.1.0-alpha.2"
channel: linkedin
title: ""
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 2321
---

Sentinel alpha v0.1.0-alpha.2 is out. It has no new features. It exists because we ran the full audit loop live against a real repository, and several of the rough edges we found affect correctness, not just polish.

The two that matter most:

1. Dedup was unstable. The previous identity included the line range the model reported, and line ranges are exactly the kind of thing models drift on between runs. The same finding would come back with a slightly different range, get a different content hash, and get refiled as a new issue. The fix is to use `rule + file + category` as the identity. Line ranges are still recorded for the human reader, but they no longer participate in dedup.

2. Filing on a fresh repo did not work. Alpha.1 assumed the filer's labels already existed. They do not, on a fresh repo, and the first `gh issue create --label sentinel` crashed the batch. Alpha.2 creates the labels it needs (`sentinel` and the suppression labels) before the first issue is filed, and tolerates the case where they already exist.

A few smaller ones round it out: a single filing failure no longer aborts the batch (each create/update/close is tolerated and reported), dry-run no longer hides audit failures (a pack that fails validation shows up in the preview), and a truncated model output is salvaged (the leading complete findings are recovered rather than thrown out). There is also a new `--resolve-after-misses` flag on `sentinel run` for tuning auto-resolution.

If you installed alpha.1, this is the version you want. It is installed the same way:

`npx @nanocollective/sentinel@0.1.0-alpha.2 init`

Sentinel is the Nano Collective's Nanocoder-driven workflow for running continuous, configurable security and code audits across the repositories in a GitHub organisation, with the findings filed as issues for a human to act on. It ships no rule packs of its own; the value comes from the packs the installing organisation writes for the code it actually ships.

Alpha.3 will address the rest of the rough edges from the same live-repo run. We are testing on our own repos and a handful of external projects at this stage. If you want your project included in that loop, get in touch on Discord. Expect breaking changes between alphas.

Repo and full notes: https://github.com/Nano-Collective/sentinel
