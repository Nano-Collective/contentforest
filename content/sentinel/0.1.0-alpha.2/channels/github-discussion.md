---
product: sentinel
version: "0.1.0-alpha.2"
channel: github-discussion
title: "Sentinel v0.1.0-alpha.2: audit-loop fixes, dedup, and label creation"
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 6963
---

# Sentinel v0.1.0-alpha.2: audit-loop fixes, dedup, and label creation

Sentinel is an installable, Nanocoder-driven workflow that runs continuous, configurable security and code audits across the repositories in a GitHub organisation, and files what it finds as issues for a human to act on. **Built by the [Nano Collective](https://nanocollective.org): a community collective building AI tooling not for profit, but for the community.**

This is the second alpha. v0.1.0-alpha.1 was the first installable build. v0.1.0-alpha.2 has no new features. It exists because we ran the full audit loop live against a real repository, and several of the rough edges we found affect correctness. An alpha.1 install has broken dedup and cannot file on a fresh repo. If you installed alpha.1, this is the version you want.

## Why this release exists

Alpha.1 was the first time Sentinel ran end-to-end against an unfamiliar repo. The config scaffolder worked, the workflow fired on schedule, the model returned findings, the parser accepted them, and the filer opened issues. That is the happy path and alpha.1 covers it. The unhappy paths are what this release is about, and several of them turned out to be correctness bugs rather than missing features.

The two that matter most are dedup and label creation. Dedup is a load-bearing piece of the design: every scheduled run produces a fresh batch of findings, and the only thing standing between a clean run and a torrent of duplicate issues is a stable identity per finding. If that identity is unstable, the filer cannot tell a new finding from one it already filed, and the issue tracker fills up. Label creation is the other load-bearing piece: the filer needs a small set of labels (`sentinel` plus the suppression labels) to apply to the issues it opens, and on a fresh repo none of those labels exist yet. If the filer doesn't create them itself, the first scheduled run on a new repo crashes before it can file a single issue.

Both behaviours were present in alpha.1, and both are fixed in alpha.2.

## What's changed

### Dedup no longer refiles duplicates

The previous dedup key included the line range the model reported. That sounds precise, and it is, but line ranges are exactly the kind of thing models report inconsistently between runs. The same finding, run twice, would come back with `42-47` one time and `43-48` the next. Each variant got a different content hash, the dedup store treated them as two different findings, and the filer refiled the issue.

The fix is to change the identity to `rule + file + category`. That's the part of a finding that's stable across runs: the rule that raised it, the file it lives in, and the category it belongs to. Line ranges are still recorded on the issue for the human reader, but they no longer participate in identity.

This is a behaviour change for anyone whose suppression rules depend on the old hash. If you've tuned `sentinel.yaml` to suppress specific content hashes, you'll need to re-derive them from the new identity the next time a finding is filed. The run summary now logs the new identity per finding so that's straightforward to capture.

### Filing works on a fresh repo

Alpha.1 assumed the filer's labels already existed on the target repo. They don't, on a fresh repo, and `gh issue create --label sentinel` against an unknown label exits non-zero. Alpha.1 propagated that failure and aborted the batch before the rest of the findings were filed.

Alpha.2 creates the labels it needs (`sentinel` and the suppression labels) before the first issue is filed, and tolerates the case where they already exist. A first run on a new repo now lands cleanly without manual label setup.

### A single filing failure no longer aborts the run

Even with labels in place, individual `gh issue create` / `gh issue edit` / `gh issue close` calls can fail for reasons that have nothing to do with the finding itself: transient API errors, a label race, a permission hiccup. Alpha.1 treated any one of those as a hard failure and skipped the rest of the batch. Alpha.2 tolerates each create/update/close individually, logs the failure, and continues. The run summary at the end lists which findings failed to file and why.

This is a quality-of-life fix more than a correctness one. We still expect every finding to file on a healthy repo, but the operational cost of one transient failure no longer is "open the workflow logs and re-run the entire batch".

### Dry-run no longer hides audit failures

The dry-run mode prints a grouped preview of what would have been filed: would-file-as-new, would-match-dedup, would-skip-below-threshold. The previous implementation only ran the grouping when the audit itself succeeded. A pack that failed validation reported as a clean dry run, because the grouping step never ran.

Alpha.2 surfaces the validation failure in the preview itself, with the failure reason and the run that produced it. If a pack is broken, you see that it's broken before you point a live run at it.

### Truncated model output is salvaged

LLM output is not a database. A long audit run can come back with the JSON array cut off mid-finding, either because the model hit its output limit or the connection dropped. The previous parser threw the whole batch away in that case. Alpha.2 recovers the leading complete findings from the array, drops the truncated tail, and files what it has. The run summary flags the truncation so it's not silent.

### New `--resolve-after-misses` flag

Auto-resolution is the part of the filer that closes issues that haven't been seen in N runs. The default is conservative: a finding has to be missing for several runs in a row before the issue is auto-closed, on the assumption that a single missed run is more likely a flaky check than a resolved finding. Some teams want a tighter loop, some want a looser one, and some want it off. `--resolve-after-misses <N>` on `sentinel run` is the knob. The default is unchanged for existing installs.

## Install

```bash
npx @nanocollective/sentinel@0.1.0-alpha.2 init
```

If you have alpha.1 already, `init` is idempotent for the existing files and will refresh the workflow to pick up the new filer. Re-run the init prompts and re-push.

## What's coming

Alpha.3 will address the rest of the rough edges from the same live-repo run, including the failure mode where two rules in the same pack produce identical `rule + file + category` identities (rare, but real). The v1 surface is otherwise stable. If you want a feature to land in v1, the most useful thing you can do is run alpha.2 against your own repos and tell us what breaks.

We are testing Sentinel on our own repos and a handful of external projects at this stage. Expect breaking changes between alphas. If you want your project audited as part of that loop, get in touch on Discord.

Repo: https://github.com/Nano-Collective/sentinel
Docs: https://docs.nanocollective.org/sentinel/docs
