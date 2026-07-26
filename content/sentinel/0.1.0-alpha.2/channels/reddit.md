---
product: sentinel
version: "0.1.0-alpha.2"
channel: reddit
title: ""
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 0
---

Hey r/opensource and r/programming, we just shipped Sentinel alpha v0.1.0-alpha.2. This is a "boring" release on purpose, and we want to talk about what that means.

## Background

Sentinel is a Nanocoder-driven workflow that runs continuous, configurable security and code audits across the repositories in your GitHub organisation and files what it finds as issues for a human to act on. You install it into your org, point it at the repos you care about, write the rule packs that describe what to look for, and a scheduled GitHub Actions workflow does the audit pass. Local models are a first-class path, so the audited code never has to leave hardware you own.

Alpha.0 was the first published prerelease, alpha.1 was the first installable build, and alpha.2 is what this post is about.

## Why this release is "no new features"

We ran the full audit loop live against a real repository for the first time in alpha.1. The happy path worked end to end: the scaffolder generated the config, the workflow fired on schedule, the model returned findings, the parser accepted them, and the filer opened issues. That is a real milestone and alpha.1 covers it.

The unhappy paths are what this release is about, and several of them turned out to be correctness bugs rather than missing features. So alpha.2 has no new features. It fixes the bits of alpha.1 that would have bitten a real install within the first week. If you are running alpha.1 today, this is the version you want.

## The two bugs that mattered most

**1. Dedup was unstable.** The previous content hash included the line range the model reported. That sounds precise, and it is, but line ranges are exactly the kind of thing models drift on between runs. The same finding, run twice, would come back with `42-47` one time and `43-48` the next. Each variant got a different hash, the dedup store treated them as two different findings, and the filer refiled the issue as a duplicate. The fix is to use `rule + file + category` as the identity. Line ranges are still recorded on the issue for the human reader, but they no longer participate in dedup.

This is a behaviour change for anyone whose suppression rules depend on the old hash. If you have tuned `sentinel.yaml` to suppress specific content hashes, you will need to re-derive them from the new identity the next time a finding is filed. The run summary now logs the new identity per finding, so it is straightforward to capture.

**2. Filing on a fresh repo did not work.** Alpha.1 assumed the filer's labels already existed on the target repo. They do not, on a fresh repo, and `gh issue create --label sentinel` against an unknown label exits non-zero. Alpha.1 propagated that failure and aborted the batch before the rest of the findings were filed. We found this one on our own test repo, where the very first scheduled run failed to file a single finding and we did not have a label called `sentinel` on the repo.

Alpha.2 creates the labels it needs (`sentinel` and the suppression labels) before the first issue is filed, and tolerates the case where they already exist. A first run on a new repo now lands cleanly without manual label setup.

## The smaller fixes

A few rough edges round out the release:

- **A single filing failure no longer aborts the run.** Even with labels in place, individual `gh issue create` / `gh issue edit` / `gh issue close` calls can fail for reasons that have nothing to do with the finding: transient API errors, a label race, a permission hiccup. Alpha.1 treated any one of those as a hard failure and skipped the rest of the batch. Alpha.2 tolerates each create/update/close individually, logs the failure, and continues. The run summary at the end lists which findings failed to file and why. This is the kind of fix you only appreciate on a flaky network.
- **Dry-run no longer hides audit failures.** The dry-run mode prints a grouped preview of what would have been filed. The previous implementation only ran the grouping when the audit itself succeeded. A pack that failed validation reported as a clean dry run, because the grouping step never ran. Alpha.2 surfaces the validation failure in the preview itself, with the failure reason and the run that produced it. If a pack is broken, you see that it is broken before you point a live run at it.
- **Truncated model output is salvaged.** A long audit run can come back with the JSON array cut off mid-finding, either because the model hit its output limit or the connection dropped. The previous parser threw the whole batch away in that case. Alpha.2 recovers the leading complete findings from the array, drops the truncated tail, and files what it has. The run summary flags the truncation so it is not silent.
- **New `--resolve-after-misses` flag.** Auto-resolution is the part of the filer that closes issues that have not been seen in N runs. The default is conservative: a finding has to be missing for several runs in a row before the issue is auto-closed, on the assumption that a single missed run is more likely a flaky check than a resolved finding. Some teams want a tighter loop, some want a looser one, and some want it off. `--resolve-after-misses <N>` on `sentinel run` is the knob. The default is unchanged for existing installs.

## Install

```bash
npx @nanocollective/sentinel@0.1.0-alpha.2 init
```

If you have alpha.1 already, `init` is idempotent for the existing files and will refresh the workflow to pick up the new filer. Re-run the init prompts and re-push.

## What is coming

Alpha.3 will address the rest of the rough edges from the same live-repo run, including the failure mode where two rules in the same pack produce identical `rule + file + category` identities (rare, but real). The v1 surface is otherwise stable. If you want a feature to land in v1, the most useful thing you can do is run alpha.2 against your own repos and tell us what breaks.

We are testing on our own repos and a handful of external projects at this stage. Expect breaking changes between alphas. If you want your project audited as part of that loop, get in touch on Discord.

## Where to find us

Repo: https://github.com/Nano-Collective/sentinel

Docs: https://docs.nanocollective.org/sentinel/docs

We are the Nano Collective, a community collective building AI tooling not for profit, but for the community. Sentinel is in active development toward its v1, and we are publishing alphas as we go so that real-world feedback can shape what lands in v1. If you have run it, even just to break it, we want to hear from you.
