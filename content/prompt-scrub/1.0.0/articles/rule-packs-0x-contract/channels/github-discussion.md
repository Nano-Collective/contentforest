---
product: prompt-scrub
version: "1.0.0"
channel: github-discussion
title: "Authoring a prompt-scrub rule pack from scratch"
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 16810
---

# Authoring a prompt-scrub rule pack from scratch

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The release announcement walked through the headline shape of `prompt-scrub`: what `scrub()` and `rehydrate()` do, why determinism matters for prompt cache prefixes, and where the threat model draws the line. A sibling post went deep on the secret detector and how its three layers stack. This post is for the other side of the same coin: how to add a detector that does not live inside the main package. Rule packs are the extension point, and the contract is small enough that you can write, test, and publish one in a sitting.

What follows is a walkthrough aimed at a developer publishing their first custom detector pack: the `Detector` interface as it actually appears in `src/types/index.ts`, the three export shapes the loader accepts, why detectors deliberately do not return a replacement string, and the four integration points you have to wire up (the package, the config, the `rules list` output, and the collision resolver that runs underneath).

## The contract in one screen

The whole rule-pack contract fits on one screen. Two interfaces, both in `src/types/index.ts`:

```ts
export interface Finding {
  category: string;
  span: [number, number]; // [startIndex, endIndex]
  value: string;
  placeholderPrefix: string;
}

export interface Detector {
  name: string;
  detect(text: string): Finding[];
}
```

That is it. A rule pack is an npm package that exports one or more objects implementing `Detector`. Each `detect()` call walks the text, finds zero or more matches, and returns them as an array of `Finding`. There is no constructor signature the loader requires, no base class you have to extend, no registry to register with. The interface is structural: if your object has a `name` and a `detect`, it slots in.

A worked example, trimmed from the existing `EmailDetector` so the shape is concrete:

```ts
import type { Detector, Finding } from '@nanocollective/prompt-scrub';

const EMAIL_REGEX = /(?<![.\w])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![.\w])/g;

export class EmailDetector implements Detector {
  readonly name = 'EmailDetector';

  detect(text: string): Finding[] {
    const findings: Finding[] = [];
    EMAIL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMAIL_REGEX.exec(text)) !== null) {
      const value = match[1] ?? match[0];
      findings.push({
        category: 'Email',
        span: [match.index, match.index + value.length],
        value,
        placeholderPrefix: 'Email',
      });
    }
    return findings;
  }
}
```

Note what the detector returns and what it does not. It returns `value` (the matched substring) and `placeholderPrefix` (the category namespace, here `'Email'`). It does not return a placeholder like `Email_2`, and the reason is structural, not stylistic.

## Why detectors never return a `replacement`

This is the part of the contract that surprises first-time authors, because every tutorial they have ever read on "how to write a redaction detector" hands them a `Finding` shape with a `replacement` field. The whitepaper for `prompt-scrub` did the same thing. The runtime contract deliberately omits it.

The reason is that the final placeholder has to be deterministic across the whole text, and the number suffix (the `2` in `Email_2`) depends on the session, not on the detector. If a detector returned `replacement: 'Email_1'` for its first match, and then a second detector also returned a match whose placeholder should be `Email_2`, the engine would have a choice between re-numbering detector A's output (which breaks the deterministic-prefix guarantee for prompt caches) or letting collisions sit across detectors. Both options are bad.

The runtime shape splits the responsibility. Detectors say two things: this is the match (`value` plus `span`), and this is what category namespace it belongs to (`placeholderPrefix`, e.g. `'Email'`). The core engine takes that, walks the resolved findings, assigns the numeric suffix per category in span order, and writes `Email_1`, `Email_2`, etc. into the session map. Rehydration gets the mapping back and swaps the placeholders for the originals.

For a rule-pack author this means two practical things:

- Do not invent your own placeholder strings inside `detect()`. The engine will overwrite them or, worse, leave them in place and confuse rehydration.
- Pick a `placeholderPrefix` that uniquely identifies your category in the user-visible output. `Codename` works for a project codename detector; `'ApiKey'` works for a third-party API detector; `'Ssn'` works for a US Social Security number detector. Two detectors that pick the same prefix will produce interleaved numbering, which is what you want.

## The three export shapes

`src/core/rule-packs.ts` accepts a rule pack if its top-level module looks like any of these:

```ts
// Shape 1: a default export that is itself an array of Detectors
export default [new MyDetector()];

// Shape 2: a named export called 'detectors' that is an array
export const detectors = [new MyDetector()];

// Shape 3: a default export that is an object with a 'detectors' property
export default { detectors: [new MyDetector()] };
```

The loader walks them in order: it prefers the named `detectors` export, falls back to a `default` array, falls back to a `default.detectors` array. Anything else is treated as "this package did not export any detectors" and a warning is printed to stderr:

```
[prompt-scrub] Warning: Rule pack "my-pack" did not export any valid detectors.
```

The same warning fires if your object is missing `name` or `detect`. Validation per-item is the check `typeof detector.detect === 'function' && typeof detector.name === 'string'`. There is no required inheritance, no decorator, no factory function. A detector is anything with the right shape.

Practical implications:

- If you are publishing one detector, the named-export shape is the simplest and reads well in tree-shaking audit output.
- If you are publishing several, exporting a `default` array keeps the import line tidy: `import myPack from 'my-pack'`.
- If your package has a meaningful namespace and you want `default` to be the package object itself, the third shape lets you add more fields later without breaking importers.

All three shapes are stable. We have not seen a strong reason to deprecate any of them, and the loader explicitly tries them all before giving up.

## What the loader actually does

`loadConfiguredRulePacks()` in `src/core/rule-packs.ts` is short. Walking it line by line is a fast way to see what guarantees you get as a rule-pack author:

1. The loader reads `loadConfig()` first. If `config.rulePacks` is empty or undefined, it returns `{ detectors: [], metadata: [] }` with no side effects.
2. For each pack name, it does a dynamic `await import(packName)`. This is bare Node dynamic import, so the package name has to resolve via the normal Node resolution rules: either an installed npm dependency, a path-style fallback used in tests, or a workspace package.
3. The export-shape detection runs and selects an array, or skips the pack with a warning.
4. Each detector is validated against the interface, and those that pass are appended to a flat list. Their `name` is paired with a metadata record `{ name, source: 'rule-pack: <packName>', defaultState: 'on' }`.
5. Failures during import are caught and warned, not thrown. A missing package or a malformed package will not crash your application. It will print a warning to stderr and continue with the rest of the rule packs.

Two consequences worth knowing:

- Dynamic import means your detector module is loaded lazily, on the first call to a `scrub()` or `rules list` path. If your module has top-level side effects, those side effects will run on first use, not on import of `prompt-scrub` itself.
- The default state for every rule-pack detector is `'on'`. There is no built-in switch to mark one off by default. If you want to ship a noisy detector behind opt-in, you have to either name it in a way that flags it as opt-in and let consumers turn it off via `ScrubOptions.disabledDetectors`, or document it loudly in your README.

## Wiring it up: the four integration points

A rule pack is nothing without the four integration points that actually make it run. Each is small; together they form the boundary between your package and the rest of the world.

### 1. The npm package

Your detector has to be reachable by Node's resolver. Publish to the registry, install in your project (`npm install my-pack`), or for local development use `npm install /path/to/my-pack`. The test suite uses the same path. Whatever you do, make sure a plain `require('my-pack')` from inside `node_modules/@nanocollective/prompt-scrub` would resolve.

### 2. Global config

In your project's config directory, `~/.config/prompt-scrub/config.json` on Linux (`~/Library/Application Support/prompt-scrub/config.json` on macOS, `%APPDATA%\prompt-scrub\config.json` on Windows), the `rulePacks` array is where you list the packages you want loaded:

```json
{
  "rulePacks": ["my-pack", "another-pack"]
}
```

The loader reads this file via `loadConfig()` and unions its `rulePacks` with the `prompt-scrub.rulePacks` field from your project `package.json`.

### 3. Project package.json

For per-project configuration, the same key lives under a `prompt-scrub` namespace in your `package.json`:

```json
{
  "prompt-scrub": {
    "rulePacks": ["my-pack"]
  }
}
```

`src/core/config.ts` reads `package.json` from `process.cwd()`, so it picks up whatever project you happen to be running from. The loader de-duplicates between the two sources via a `Set`, so a package listed in both ends up loaded exactly once.

### 4. The `rules list` CLI command

Once configured, your detectors show up alongside the built-ins when a user runs `prompt-scrub rules list`:

```
$ npx prompt-scrub rules list
Detector                 Source                          Default State
----------------         ------------------------------  -------------
SecretDetector           built-in                        on
EmailDetector            built-in                        on
UrlDetector              built-in                        on
PathDetector             built-in                        on
PhoneDetector            built-in                        on
AddressDetector          built-in                        on
NameDetector             built-in                        off
CodeTellDetector         built-in                        off
MyDetector               rule-pack: my-pack              on
```

This command is what people use to check that a pack is actually loaded. If your detector does not show up in this output, the loader silently skipped it and the most likely cause is a bad export shape. Check for the warning printed at startup first.

## Collision behaviour: where your detector slots in

The reason the contract is small is that the heavy lifting lives in `resolveCollisions()` in `src/core/collision-resolver.ts`. Your detector's findings are pooled with the built-ins, then a single pass resolves overlaps. The rules:

1. Findings are sorted by `span[0]` ascending and walked left to right.
2. Each new finding is checked against the accepted list for overlap. Non-overlapping candidates are accepted directly.
3. On overlap, the detector with the lower priority number wins. Priority is hard-coded in `DETECTOR_PRIORITY`: `SecretDetector` is 1, `EmailDetector` is 2, `UrlDetector` is 3, and so on through `CodeTellDetector` at 8.
4. Anything else has priority `99`, including rule-pack detectors. If your finding overlaps with `SecretDetector`, the secret wins, every time. This is the "missing a credential is worse than missing a name" policy, applied mechanically.
5. Equal priority overlaps resolve in favour of the longer span.

The implication for rule-pack authors is that your detector's findings will survive only when they do not conflict with a higher-priority built-in. Two patterns show up in practice:

- **Pick a category the built-ins do not touch.** Custom codenames, internal ticket numbers, third-party vendor tokens the secret detector does not know about. They will not collide with built-ins, so they survive.
- **Be specific enough that the span is the right one.** A detector that flags "open the App" as code-tell-shaped text will lose to the path detector if "App" is part of a path. Tighten the regex.

`docs/features/authoring-rule-packs.md` calls out the priority table verbatim, including the note that there is no public mechanism for a custom detector to override `SecretDetector` and there will not be one. That policy is what keeps the secret detector useful for the cases it is tuned for, and it is not negotiable through the rule-pack API.

## A minimal end-to-end pack

To make the moving parts concrete, this is a pack that detects internal project codenames for two strings, `Apollo` and `Zeus`. It uses the named-export shape and TypeScript:

```ts
// src/index.ts
import type { Detector, Finding } from '@nanocollective/prompt-scrub';

const PROJECT_X_REGEX = /\b(Apollo|Zeus)\b/g;

export class ProjectXDetector implements Detector {
  readonly name = 'ProjectXDetector';

  detect(text: string): Finding[] {
    const findings: Finding[] = [];
    PROJECT_X_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PROJECT_X_REGEX.exec(text)) !== null) {
      findings.push({
        category: 'ProjectX',
        span: [match.index, match.index + match[0].length],
        value: match[0],
        placeholderPrefix: 'Codename',
      });
    }
    return findings;
  }
}

export const detectors = [new ProjectXDetector()];
```

Build and publish the package (`prompt-scrub-projectx` here), then list it in the user's `package.json`:

```json
{
  "prompt-scrub": {
    "rulePacks": ["prompt-scrub-projectx"]
  }
}
```

Run `prompt-scrub rules list`. The new detector shows up with `Source: rule-pack: prompt-scrub-projectx` and `Default State: on`. From that point on, any text scrubbed via the library or CLI gets every occurrence of `Apollo` and `Zeus` replaced with `Codename_1`, `Codename_2`, etc., in source order, in the same pass that catches emails and paths.

The packing itself is unremarkable. What is worth taking away is how few places in the system know about your detector: the loader, the metadata entry for `rules list`, and the collision resolver. Everything else (the placeholder numbering, the session map, the rehydration pass) does not need to know that your detector exists. That is the shape of a contract designed to be small on purpose.

## What is stable and what is not

`prompt-scrub` is at 1.0.0 and the rule-pack contract shipped in this release. The two interfaces reproduced above (`Detector` and `Finding`) are documented as the runtime contract for everything outside the package. The general approach is conservative: any change to a public interface is a breaking change for rule packs and would land in a major version bump.

What is reasonable to expect to grow (additive, non-breaking):

- The metadata entry. `defaultState` is the only knob exposed today. If a rule-pack author needs to mark a detector as off by default, that would land as a new optional field rather than as a replacement.
- The export shapes. All three are exercised in the tests. A fourth (an async loader, say) would be additive if it kept the existing ones working.

What we do not plan to change:

- The collision table. Built-in priority is documented in `docs/features/detectors.md`. There are no plans to expose priority to rule-pack authors, because the secret-priority behaviour is a deliberate trade the whole product depends on.

Until something in `src/types/index.ts` moves, the contract you see there is the contract your pack will run against.

## Where to look in the repo

- `src/types/index.ts` for the canonical `Detector` and `Finding` shapes.
- `src/core/rule-packs.ts` for the loader (about 70 lines including comments).
- `src/core/config.ts` for how global config and `package.json` are read and merged.
- `src/core/collision-resolver.ts` for the priority table and the overlap pass.
- `docs/features/authoring-rule-packs.md` for the user-facing version of the same contract.

Issues, PRs, and rule-pack proposals are welcome at the repo. If you write one, please include a minimal test that exercises each of the three export shapes, plus a `rules list` line so others can see what they get when they install it.

Source, tests, and the full rule-pack contract: https://github.com/Nano-Collective/prompt-scrubber
