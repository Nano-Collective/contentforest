---
title: ContentForest — Team Member Config
status: live
owner: Will Lamerton
---

# Team Member Config (`config/team.json`)

If you want ContentForest to generate **personal-pack** posts for you — channel posts in your voice, grounded in an existing release or collective pack — you need an entry in `config/team.json`. This doc walks you through filling one out.

## TL;DR

Open a PR adding your entry to `config/team.json`. Once it's merged, the [Request Personal Pack](https://github.com/Nano-Collective/contentforest/issues/new/choose) issue template will list you in its dropdown automatically (a sync workflow takes ~30 s after merge).

You only get personal posts on channels you list here. Channel rules here are the **only** rules consulted for your personal files — `config/channels.json` is not used for personal validation. So everything that constrains a personal post — character limits, word counts, hashtag bans, formatting tics — lives in your entry.

## The shape

`config/team.json` is an array. Each entry is a team member:

```json
{
  "slug": "<your-slug>",
  "name": "<Your Name>",
  "github": "<your-gh-handle>",
  "role": "<your role>",
  "agent_mode": "bundled" | "per-channel",
  "voice": {
    "tone": "<one paragraph>",
    "do": ["<rule>", "..."],
    "dont": ["<rule>", "..."],
    "samples": ["<your own writing>", "..."]
  },
  "channels": [
    {
      "slug": "<channel>",
      "kind": "social" | "long-form",
      "handle": "<optional handle/url>",
      "min_words": <number>,
      "max_words": <number>,
      "max_chars": <number>,
      "rules": ["<rule>", "..."],
      "bundle_with": ["<sibling-channel-slug>", "..."]
    }
  ]
}
```

Order doesn't matter inside an entry. The validator rejects unknown fields, missing required fields, and duplicates (between members or between channels within a member), so a typo will fail CI rather than silently stick.

## Top-level fields

| Field | Required | What it's for |
| --- | --- | --- |
| `slug` | yes | Kebab-case identifier for you — appears in the issue-form dropdown, the file path (`personal/<slug>/`), and frontmatter. Pick once and don't change it; renaming is a code-search-and-rename across committed packs. |
| `name` | yes | Full name. Used in the agent prompt for prose ("Will would phrase this as…"). |
| `github` | yes | GitHub handle (no `@`). Recorded but not currently used for gating — anyone can request a personal pack for anyone. |
| `role` | yes | Short role string. Helps the agent calibrate register (e.g. `"Lead, ContentForest"` vs `"Community contributor"`). |
| `voice` | yes | Object — see below. The most important field. The agent reads this every time it generates a post in your voice. |
| `channels` | yes | Array — see below. Each entry is a channel you publish on. |
| `agent_mode` | no | `"bundled"` (default) or `"per-channel"`. Controls how many Nanocoder spawns run for your channel phase — see [agent mode](#agent-mode-bundled-vs-per-channel) below. |

## `voice`

This is what makes the personal post *yours* and not generic. Spend real time on it. The agent's job is to take the canonical pack post and re-frame it in the voice you describe here — if your description is vague, the output reads generic.

| Field | What it's for |
| --- | --- |
| `tone` | One paragraph. How would someone describe how you write? Are you understated? Direct? Conversational? First-person or "we"? Long sentences or short? Hedging or assertive? Be concrete — "operational, plainspoken" is more useful than "professional but engaging". |
| `do` | Bulleted list of things you *do* in your posts. Concrete tics, not generic principles. "Lead with the operational detail." "Use numbers when you have them." "Acknowledge tradeoffs out loud." |
| `dont` | Bulleted list of things you *don't*. Concrete things to avoid. "No hashtags on LinkedIn." "Don't lead with 'excited to announce'." "Never promise future capabilities." |
| `samples` | Optional. Paragraphs you've actually written that exemplify your voice. The agent reads them as calibration. Two or three is enough; if you don't have any, leave the array empty (`[]`) and lean harder on `tone` / `do` / `dont`. |

The collective's brand rules (forbidden phrases like "Sovereign AI", marketing-register words like "transformative") apply on top of your voice — the validator enforces them. Don't restate them in your `dont`; they're already covered.

## `channels`

This is the **allowlist** of channels you publish on. A channel that isn't listed here will not be generated for you, even if it appears in the base pack. A channel that *is* listed will be generated regardless of whether the base pack targets it (member-only channels — e.g. a personal Medium post when the base pack didn't target Medium — are fine).

Each channel entry:

| Field | Required | What it's for |
| --- | --- | --- |
| `slug` | yes | Kebab-case channel identifier. Match canonical channel slugs where they apply (`linkedin`, `x`, `github-discussion`, `reddit`); use your own for channels not in `config/channels.json` (`medium`, `substack`, `mastodon`, etc). |
| `kind` | yes | `"social"` for short / immediate-feed channels; `"long-form"` for blog-shaped channels. The validator currently treats them the same — `kind` is there for the agent's framing. |
| `handle` | no | Your handle or URL on this channel (e.g. `"in/will-lamerton"`, `"willlamerton"`). Recorded but not auto-linked; useful as future-proofing. |
| `min_words` | no | Hard floor — bodies shorter than this fail validation. Skip on `x` (use `max_chars`). |
| `max_words` | no | Hard ceiling — failures block. Be **generous**; tight ceilings squeeze depth and produce filler when the angle has more to say. Bias up. |
| `max_chars` | no | Hard ceiling on body characters. Use for `x` (280) and any other strict-length channel. |
| `rules` | no | Array of channel-specific guidance the agent must follow. "No hashtags." "Lead with the operational detail." "One link, no thread." Concrete and short — these go into the agent prompt verbatim. |
| `bundle_with` | no | Array of sibling channel slugs (same member) that must be written by the same agent spawn when `agent_mode: "per-channel"`. Ignored in bundled mode. Use this for channels that are companions — e.g. a LinkedIn standalone post that pairs with a LinkedIn newsletter issue. Transitive: A→B and B→C end up in one group. |

### Picking limits

Looking at `config/channels.json` is a reasonable starting point — but it's a starting point, not a constraint. Your personal cadence may run shorter or longer than the canonical pack. Personal LinkedIn posts often want to be tighter than the canonical version (your audience trusts you, no need to re-prove the case); personal Medium posts often want to run longer (you're using the long-form room intentionally). Bias generous on `max_words` — if it turns out the agent writes too much, you can lower it later.

## Agent mode: bundled vs per-channel

`agent_mode` controls how many Nanocoder spawns run when generating your channel phase. Default is `"bundled"` — one spawn produces every channel in one pass. That's fine for most members: 2–3 channels, a handful of pieces, the agent juggles them comfortably.

If you publish to many channels — or a single channel that itself produces a batch (e.g. seven X posts per release cycle) — bundled mode strains. The agent's attention thins across all the rules at once, output drifts, and a single channel's failure pushes the whole batch into the auto-fix loop. Switch to `"per-channel"`:

```json
"agent_mode": "per-channel"
```

In per-channel mode the orchestrator partitions your `channels[]` into groups and spawns one Nanocoder per group. Each spawn sees only its own channel rules, writes only its own files, and validates only its own scope. Failures in one channel don't affect the others.

**Groups** are formed by `bundle_with`. A channel with no `bundle_with` is its own group. A channel with `bundle_with: ["linkedin"]` co-locates with `linkedin` in one group, so they're written by the same spawn — useful when channels are companions and need to be co-written (Ben's LinkedIn newsletter rule, for instance, requires a companion LinkedIn standalone post per issue; without bundling, those would be split across spawns and lose coherence).

Per-channel mode is **opt-in per member** — it changes nothing for anyone else. The articles phase always stays bundled (one spawn per request, regardless of mode). Edit mode (driven by `/change` PR comments) also stays bundled regardless of mode — the change request is usually targeted at one file and partitioning loses cross-file context.

**When to enable it:**

- You have ≥ 4 channels.
- One channel produces a batch (e.g. multiple posts per release).
- Bundled generation is failing or timing out frequently.

**When not to:**

- 2–3 simple channels — bundled is faster (one spawn, less validator-spawn overhead).
- You want every channel to "know about" the others as it writes them. Per-channel deliberately scopes each spawn to its own rules.

## Worked example

Will's entry, abridged with comments:

```json
{
  "slug": "will",
  "name": "Will Lamerton",
  "github": "willlamerton",
  "role": "Lead, ContentForest",
  "voice": {
    "tone": "Operational, plainspoken, hedge the future. Closer to engineering notes than thought-leadership. First-person — these posts are mine, not the collective's. Comfortable saying \"we tried X, it didn't work, so we shipped Y.\"",
    "do": [
      "Lead with the operational detail or the concrete change, not the meta-narrative.",
      "Be specific: numbers, named subsystems, before/after.",
      "Acknowledge tradeoffs and constraints out loud when they shaped the decision.",
      "Talk to other developers as peers, not prospects."
    ],
    "dont": [
      "Use hashtags on LinkedIn or X.",
      "Lead with marketing framing (\"excited to announce…\").",
      "Recap the release at length — the canonical pack already does that.",
      "Promise future capabilities. If something isn't shipped, don't claim it."
    ],
    "samples": []
  },
  "channels": [
    {
      "slug": "linkedin",
      "kind": "social",
      "handle": "in/will-lamerton",
      "min_words": 120,
      "max_words": 500,
      "rules": [
        "Lead with the operational detail. No hashtags.",
        "One link to the canonical pack post or the product repo."
      ]
    },
    {
      "slug": "x",
      "kind": "social",
      "handle": "willlamerton",
      "max_chars": 280,
      "rules": ["≤ 280 chars including link. No hashtags. One link."]
    }
  ]
}
```

## Validation — what fails the PR

The schema is hand-validated in `lib/team.ts`. CI rejects:

- Missing required fields (`slug`, `name`, `github`, `role`, `voice`, `channels`).
- Non-kebab-case slugs (member or channel).
- Duplicate slugs (across members, or across channels within one member).
- Unknown channel `kind` (only `social` and `long-form`).
- Unknown `agent_mode` (only `bundled` and `per-channel`).
- `bundle_with` referencing a channel that doesn't exist on the same member, or referencing the channel itself.
- Negative numeric fields.
- Wrong-shape `voice` (e.g. `do` is a string instead of an array).

Errors point at the offending path (`team[1].channels[0].slug`) so they're easy to fix. Full schema in [`lib/team.ts`](../lib/team.ts) if you want to read the source.

## Adding yourself

1. Open `config/team.json` and append your entry to the array.
2. Run `pnpm test:ava lib/team.spec.ts` locally to confirm the schema is happy.
3. Open a PR. The PR checks include the team-config tests; CI fails fast on schema errors.
4. After merge, the `Sync Team Members` workflow regenerates the issue-template dropdown automatically.
5. Open a [Request Personal Pack](https://github.com/Nano-Collective/contentforest/issues/new/choose) issue to test-drive your config — pick yourself, pick an existing pack, see what the agent produces in your voice. Iterate on `voice` / `channels` based on what comes out.

## When to update

You don't need to touch your entry between releases — it's not per-pack config. Update when:

- You start (or stop) publishing on a channel.
- A few personal-pack runs read off-voice in a consistent direction (tighten `do` / `dont`, add a sample).
- You realise a `max_words` is squeezing depth out (raise it; bias up).

Each update is a small PR. Personal packs already on `main` won't be re-validated against the new schema, so historic packs are unaffected.
