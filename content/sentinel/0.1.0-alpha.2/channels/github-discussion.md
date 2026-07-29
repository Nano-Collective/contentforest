---
product: sentinel
version: "0.1.0-alpha.2"
channel: github-discussion
title: "Introducing Sentinel: a Nanocoder-driven audit workflow for your GitHub org"
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 8246
distributed_at: "2026-07-29T09:55:08.128Z"
---

# Introducing Sentinel: a Nanocoder-driven audit workflow for your GitHub org

We are publishing the first public build of Sentinel. **Built by the [Nano Collective](https://nanocollective.org): a community collective building AI tooling not for profit, but for the community.**

Sentinel is an installable, Nanocoder-driven workflow that runs continuous, configurable security and code audits across the repositories in a GitHub organisation, and files what it finds as issues for a human to act on. You install it into your org, point it at the repos you care about, write the rule packs that describe what to look for, and a scheduled GitHub Actions workflow does the audit pass. Findings are filed as issues on the target repo, with stable identities so the same finding does not get refiled on every run. Local models are a first-class path, so the audited code does not have to leave hardware you own.

The version you can install today is v0.1.0-alpha.2. It is an alpha. The audit loop is real and has been run end to end against a live repository, but the contract is not stable and the rule packs are not yet ready for production. We are publishing it now so that real-world feedback can shape what lands in v1.

## What Sentinel does

The high-level shape is the same regardless of how you tune it:

1. **You install Sentinel into a GitHub organisation.** `npx @nanocollective/sentinel init` scaffolds the config and a GitHub Actions workflow.
2. **You write rule packs.** A pack is a set of rules that describe what to look for in a given repo or set of repos. Sentinel ships no rule packs of its own; the value comes from the packs the installing organisation writes for the code it actually ships. Security scanning, code-style audits, compliance checks, internal-best-practice review: anything that can be expressed as "look at this file and tell me whether X holds" is a fit.
3. **The workflow runs on a schedule.** A scheduled GitHub Actions workflow invokes the audit, which uses Nanocoder (or a local model of your choice) to produce a structured list of findings.
4. **The filer turns findings into issues.** Each finding is filed against the target repo as a labelled issue. If the same finding is seen again, it is not refiled; the existing issue is updated. If a finding has not been seen in N runs, the issue is auto-closed.
5. **A human acts on the issues.** Sentinel does not rewrite code or open PRs. It is a triage layer, not a fixer.

Everything below walks through the parts of that loop in more detail.

## The audit loop

The audit step is a Nanocoder run against the target repo. You give it a rule pack, the repo, and the model you want to use. It returns a JSON array of findings. Each finding has a rule, a file, a category, a human-readable description, and a line range. The line range is recorded for the human reader but is not part of the finding's identity; see the section on dedup below for why.

A run can produce a long array. The parser knows how to handle a truncated model response: the leading complete findings are recovered, the truncated tail is dropped, and the run summary flags the truncation so it is not silent. A validation failure in the audit itself is surfaced in the preview of any subsequent dry run, so a broken pack is visible before you point a live run at it.

## Dedup: why `rule + file + category` is the identity

Every scheduled run produces a fresh batch of findings. The thing standing between a clean run and a torrent of duplicate issues is a stable identity per finding. If that identity is unstable, the filer cannot tell a new finding from one it already filed, and the issue tracker fills up.

The identity we use is `rule + file + category`. That is the part of a finding that is stable across runs: the rule that raised it, the file it lives in, and the category it belongs to. Line ranges sounded precise, and they are, but they are also exactly the kind of thing models report inconsistently between runs. The same finding, run twice, would come back with `42-47` one time and `43-48` the next. Each variant would get a different hash, the dedup store would treat them as two different findings, and the filer would refile the issue. Using `rule + file + category` keeps the identity stable.

If you have tuned `sentinel.yaml` to suppress specific content hashes from an earlier build, you will need to re-derive them from the new identity the next time a finding is filed. The run summary logs the new identity per finding so it is straightforward to capture.

## Filing on a fresh repo

The filer needs a small set of labels to apply to the issues it opens: `sentinel` plus the suppression labels. On a fresh repo, none of those labels exist yet. The filer creates the ones it needs before the first issue is filed, and tolerates the case where they already exist. A first run on a new repo lands cleanly without manual label setup.

Individual `gh issue create` / `gh issue edit` / `gh issue close` calls can still fail for reasons that have nothing to do with the finding itself: transient API errors, a label race, a permission hiccup. Each create/update/close is tolerated individually, the failure is logged, and the run continues. The run summary at the end lists which findings failed to file and why. The operational cost of one transient failure is no longer "open the workflow logs and re-run the entire batch".

## Auto-resolution

Some findings stop being true. A vulnerability is fixed, a style violation is cleaned up, a compliance rule is no longer relevant. The filer can close the corresponding issue automatically if the finding has not been seen in N scheduled runs. The default is conservative: a finding has to be missing for several runs in a row before the issue is closed, on the assumption that a single missed run is more likely a flaky check than a resolved finding. Some teams want a tighter loop, some want a looser one, and some want it off. `--resolve-after-misses <N>` on `sentinel run` is the knob. The default is unchanged for existing installs.

## Dry-run

Before pointing a live run at a repo, you can preview what would be filed. The dry-run mode prints a grouped preview: would-file-as-new, would-match-dedup, would-skip-below-threshold. If a pack fails validation, the failure surfaces in the preview itself, with the reason and the run that produced it. You see that a pack is broken before you commit to a live run.

## What Sentinel does not do

Sentinel is a triage layer. It does not rewrite code, open PRs, or push fixes. It does not ship rule packs. It does not, on its own, decide what counts as a bug worth filing; that is what the rule packs are for, and writing them is the work the installing organisation does. The audit loop is a model in a workflow, and the model is what the model is: a model. The findings are a starting point for a human review, not a verdict.

This is intentional. The judgement about what to fix, in what order, and how, stays with the people who own the code.

## Install

```bash
npx @nanocollective/sentinel@0.1.0-alpha.2 init
```

`init` scaffolds the config, the workflow, and a starter `sentinel.yaml`. It is idempotent for existing files and will refresh the workflow to pick up the latest filer if you re-run it.

## What is coming

V1.0 is the goal. The contract for the audit loop, the rule pack format, the filer, and the auto-resolution knobs should not change between now and v1 unless a real install breaks. The rough edges we have found so far, including the rare case where two rules in the same pack produce identical `rule + file + category` identities, will be addressed in the next alpha. The most useful thing you can do to shape v1 is run Sentinel against your own repos and tell us what breaks. We are testing on our own repos and a handful of external projects at this stage.

Expect breaking changes between alphas. If you want your project audited as part of that loop, get in touch on Discord.

## Links

Repo: https://github.com/Nano-Collective/sentinel

Docs: https://docs.nanocollective.org/sentinel/docs

Built by the [Nano Collective](https://nanocollective.org): a community collective building AI tooling not for profit, but for the community.
