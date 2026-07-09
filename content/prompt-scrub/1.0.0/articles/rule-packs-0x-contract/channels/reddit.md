---
product: prompt-scrub
version: "1.0.0"
channel: reddit
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 6348
---

We just shipped the rule-pack contract for `prompt-scrub` and we want to walk through it, because the contract is small enough that you can read it on a coffee break and substantive enough that you can publish a real pack in an afternoon.

The pitch is simple: `prompt-scrub` ships eight built-in detectors (email, phone, postal address, path, secret, url, name as opt-in, code-tell as opt-in), but the cases that matter for one team are never quite the cases that matter for the next. Rule packs let you publish an npm package that contributes additional detectors without forking the core. They are the primary extension point, and the loader has been wired up to make them feel like a normal import.

The contract is two TypeScript interfaces in `src/types/index.ts`. Here is the whole thing:

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

A detector is anything with a `name` and a `detect` method. The interface is structural (no base class to extend), so the implementation can be a class, a plain object, or anything in between. `detect()` walks the text and returns an array of `Finding`s. That is the whole shape.

There are three export shapes the loader accepts (`src/core/rule-packs.ts`). A rule pack module can be:

1. A `default` export that is an array of detectors: `export default [new MyDetector()]`.
2. A named export called `detectors` that is the array: `export const detectors = [new MyDetector()]`.
3. A `default` export object with a `detectors` property: `export default { detectors: [new MyDetector()] }`.

The loader tries them in order and silently skips anything else with a stderr warning. We have seen all three shapes in the wild; the named-export form is the cleanest for a single detector, the `default` array reads well for packs with several detectors, and the third shape gives you a namespaced package object if you want to grow into it later. None of the three is on a deprecation path.

The thing that surprises first-time authors is that `Finding` does not have a `replacement` field. Every "build a redaction detector" tutorial out there hands you `{ category, span, replacement }`, and the whitepaper for prompt-scrub originally did the same. The runtime contract deliberately omits it.

The reason is structural. The final placeholder is something like `Email_2`, where the `2` is a per-session counter. That counter is a session-wide value, not a detector-local value. If a detector returned `replacement: 'Email_1'` for its first match, the engine would have a choice between re-numbering detector A's output (which breaks the byte-stable cache-prefix guarantee prompt caching depends on) or letting collisions sit across detectors. Both options are bad, so the runtime shape splits the responsibility: detectors say "this is the match" (`value` + `span`) and "this is the category namespace" (`placeholderPrefix` like `Email` or `Codename`). The core engine takes that, numbers the placeholders in source order across all detectors, and writes the session map.

For rule-pack authors this means: do not invent your own placeholder strings inside `detect()`. Pick a meaningful, unique `placeholderPrefix` for your category, and let the engine do the numbering. `Codename`, `ApiKey`, `Ssn`, `Ticket` all work. Two detectors that pick the same prefix will produce interleaved numbering across detections, which is fine and often what you want.

Wiring a pack up to the loader has four integration points:

- The package. Publish it (or `npm install /path/to/local-pack` for development). The loader uses Node's dynamic `import()`, so anything the resolver can find works.
- Global config. `~/.config/prompt-scrub/config.json` on Linux, `~/Library/Application Support/prompt-scrub/config.json` on macOS, the roaming AppData dir on Windows. The `rulePacks` array is where you list packages. Overridable via `PROMPT_SCRUB_CONFIG_DIR` for tests.
- Project package.json. For per-project configuration, the same list lives under a `prompt-scrub` namespace in your `package.json`. The loader unions the two sources and de-duplicates, so a package listed in both still loads once.
- The `prompt-scrub rules list` CLI command. This is the diagnostic. If your detector does not appear in the output, the loader skipped it and you have a bad export shape. Check the stderr warning first.

The collision behaviour is the last thing worth understanding. Findings from your detector are pooled with the built-ins and run through `resolveCollisions()` in `src/core/collision-resolver.ts`. Built-in detectors have a hard-coded priority table: `SecretDetector` is 1 (highest), then `EmailDetector`, `UrlDetector`, `PathDetector`, `PhoneDetector`, `AddressDetector`, `NameDetector`, `CodeTellDetector`. Anything else, including rule-pack detectors, is priority 99.

The implication: if your finding overlaps a credential, the secret wins. This is the "missing a credential is worse than missing a name" policy, applied mechanically. The docs are explicit that there is no public mechanism for a custom detector to override `SecretDetector` and there will not be one. In practice this means you should pick categories that do not collide with the built-ins (custom codenames, internal ticket numbers, third-party vendor tokens the secret detector does not know), and make sure your spans are tighter than whatever category might also be in the running. A loose regex that flags "open the App" as code-tell-shaped text will lose to the path detector if "App" is part of a path.

The full long-form post walks through a minimal end-to-end pack called `ProjectXDetector` that catches two internal codenames (`Apollo` and `Zeus`), builds it, lists it in `package.json`, and shows the `rules list` output. The repo link at the bottom has the test suite (including the three export shapes) and the loader source, both of which are short enough to read in a sitting.

If you ship a real-world rule pack that exposes a problem with the contract, we want to hear about it before we have to make the contract bigger. Issues and PRs at the repo.

Source, tests, and the rule-pack contract: https://github.com/Nano-Collective/prompt-scrubber
