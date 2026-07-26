---
product: sentinel
version: "0.1.0-alpha.2"
channel: reddit
title: ""
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 5887
---

Hey r/opensource and r/programming, we are publishing the first public build of Sentinel, a Nanocoder-driven workflow for running continuous, configurable security and code audits across the repositories in a GitHub organisation and filing the findings as issues for a human to act on. The version you can install today is v0.1.0-alpha.2. This post is the announcement.

## What Sentinel is

You install Sentinel into a GitHub organisation, point it at the repos you care about, write the rule packs that describe what to look for, and a scheduled GitHub Actions workflow does the audit pass. Each finding is filed against the target repo as a labelled issue. If the same finding is seen again, it is not refiled; the existing issue is updated. If a finding has not been seen in N scheduled runs, the issue is auto-closed.

Local models are a first-class path, so the audited code does not have to leave hardware you own. Sentinel ships no rule packs of its own; the value comes from the packs the installing organisation writes for the code it actually ships.

## What this first public build does

A few of the things that have shaped the version you can install today:

**The audit loop is a Nanocoder run.** You give it a rule pack, a repo, and the model you want to use. It returns a JSON array of findings, each with a rule, a file, a category, a human-readable description, and a line range. The line range is recorded for the human reader but is not part of the finding's identity, because models drift on line ranges between runs. The parser handles a truncated model response by recovering the leading complete findings, dropping the truncated tail, and flagging the truncation in the run summary.

**Dedup uses `rule + file + category` as the identity.** Every scheduled run produces a fresh batch of findings. The thing standing between a clean run and a torrent of duplicate issues is a stable identity per finding. Line ranges sounded precise, and they are, but they are exactly the kind of thing models report inconsistently between runs. The same finding, run twice, would come back with `42-47` one time and `43-48` the next. Using `rule + file + category` keeps the identity stable. If you have tuned `sentinel.yaml` to suppress specific content hashes from an earlier build, the run summary logs the new identity per finding so it is straightforward to capture.

**The filer creates its own labels.** A fresh repo does not have the `sentinel` label or the suppression labels. The filer creates the ones it needs before the first issue is filed, and tolerates the case where they already exist. A first run on a new repo lands cleanly without manual label setup.

**One bad issue call does not abort the run.** Individual `gh issue create` / `gh issue edit` / `gh issue close` calls can fail for reasons that have nothing to do with the finding itself: transient API errors, a label race, a permission hiccup. Each create/update/close is tolerated individually, the failure is logged, and the run continues. The run summary at the end lists which findings failed to file and why.

**Dry-run is honest.** Before pointing a live run at a repo, you can preview what would be filed: would-file-as-new, would-match-dedup, would-skip-below-threshold. If a pack fails validation, the failure surfaces in the preview itself, with the reason and the run that produced it. You see that a pack is broken before you commit to a live run.

**Auto-resolution is tunable.** A finding that has not been seen in N scheduled runs can have its issue auto-closed. The default is conservative: a finding has to be missing for several runs before the issue is closed, on the assumption that a single missed run is more likely a flaky check than a resolved finding. Some teams want a tighter loop, some want a looser one, and some want it off. `--resolve-after-misses <N>` on `sentinel run` is the knob.

## What Sentinel does not do

Sentinel is a triage layer. It does not rewrite code, open PRs, or push fixes. It does not ship rule packs. It does not, on its own, decide what counts as a bug worth filing; that is what the rule packs are for, and writing them is the work the installing organisation does. The audit loop is a model in a workflow, and the model is what the model is: a model. Findings are a starting point for a human review, not a verdict.

This is intentional. The judgement about what to fix, in what order, and how, stays with the people who own the code.

## Install

```bash
npx @nanocollective/sentinel@0.1.0-alpha.2 init
```

`init` scaffolds the config, the workflow, and a starter `sentinel.yaml`. It is idempotent for existing files and will refresh the workflow to pick up the latest filer if you re-run it.

## What is coming

V1.0 is the goal. The contract for the audit loop, the rule pack format, the filer, and the auto-resolution knobs should not change between now and v1 unless a real install breaks. The rough edges we have found so far, including the rare case where two rules in the same pack produce identical `rule + file + category` identities, will be addressed in the next alpha. The most useful thing you can do to shape v1 is run Sentinel against your own repos and tell us what breaks. We are testing on our own repos and a handful of external projects at this stage.

Expect breaking changes between alphas. If you want your project audited as part of that loop, get in touch on Discord.

## Where to find us

Repo: https://github.com/Nano-Collective/sentinel

Docs: https://docs.nanocollective.org/sentinel/docs

We are the Nano Collective, a community collective building AI tooling not for profit, but for the community. Sentinel is in active development toward its v1, and we are publishing alphas as we go so that real-world feedback can shape what lands in v1. If you have run it, even just to break it, we want to hear from you.
