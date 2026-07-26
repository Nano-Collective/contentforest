---
product: sentinel
version: "0.1.0-alpha.2"
channel: linkedin
title: ""
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 2689
---

We are publishing the first public build of Sentinel, the Nano Collective's Nanocoder-driven workflow for running continuous, configurable security and code audits across the repositories in a GitHub organisation and filing the findings as issues for a human to act on. The version you can install today is v0.1.0-alpha.2.

Sentinel is a triage layer. You install it into your org, point it at the repos you care about, and write the rule packs that describe what to look for. A scheduled GitHub Actions workflow does the audit pass, and each finding is filed against the target repo as a labelled issue. The same finding is not refiled on every run; the existing issue is updated. If a finding has not been seen in N runs, the issue is auto-closed. Local models are a first-class path, so the audited code does not have to leave hardware you own.

A few of the things that have shaped this first public build:

- **Stable dedup.** The finding identity is `rule + file + category`. Line ranges are recorded for the human reader but are not part of the identity, because models tend to drift on line ranges between runs.
- **Works on a fresh repo.** The filer creates the labels it needs (`sentinel` and the suppression labels) before the first issue is filed, and tolerates the case where they already exist.
- **One bad issue call does not abort the run.** Each `gh issue create` / `edit` / `close` is tolerated individually, logged, and the run continues. The run summary lists which findings failed to file and why.
- **Dry-run is honest.** If a pack fails validation, the failure surfaces in the preview, with the reason and the run that produced it.
- **Truncated model output is salvaged.** A long audit run that comes back with the JSON array cut off mid-finding is recovered: the leading complete findings are filed, the truncated tail is dropped, and the run summary flags the truncation.
- **Tunable auto-resolution.** `--resolve-after-misses <N>` on `sentinel run` controls how many runs a finding has to be missing before its issue is auto-closed. The default is conservative.

Sentinel is an alpha. It ships no rule packs of its own; the value comes from the packs the installing organisation writes for the code it actually ships. We are testing on our own repos and a handful of external projects at this stage. Expect breaking changes between alphas. If you want your project audited as part of that loop, get in touch on Discord.

Install:

`npx @nanocollective/sentinel@0.1.0-alpha.2 init`

Repo and full notes: https://github.com/Nano-Collective/sentinel

Built by the Nano Collective: a community collective building AI tooling not for profit, but for the community.
