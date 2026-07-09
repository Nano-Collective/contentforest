---
product: prompt-scrub
version: "1.0.0"
channel: linkedin
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 2752
---

If you have ever wanted to add a custom detector to `prompt-scrub` without forking the package, the rule-pack contract is what you are looking for. It is small enough to read in one sitting and consistent enough that a published pack can rely on it.

The whole contract is two TypeScript interfaces in `src/types/index.ts`:

- `Detector`: an object with a `name` and a `detect(text)` method.
- `Finding`: `{ category, span, value, placeholderPrefix }`.

That is the whole shape. A rule pack is an npm package whose top-level module exports one or more `Detector` objects in any of three accepted forms:

1. A `default` export that is itself an array of detectors.
2. A named export called `detectors` that is the array.
3. A `default` export object with a `detectors` property.

The loader in `src/core/rule-packs.ts` tries them in order and falls back gracefully. Missing or malformed detectors are skipped with a stderr warning rather than crashing the application, so a broken pack does not take down a working setup.

The one part of the contract that surprises first-time authors is that detectors deliberately do not return a `replacement` field. The runtime shape hands back `value` (the matched substring) and `placeholderPrefix` (the category namespace), and the core engine assigns the numeric suffix in source order. The reason is structural: a final placeholder depends on the session, not on the detector, and pushing that responsibility into individual detectors would break the byte-stable cache-prefix guarantee. Keep the prefix meaningful and unique to your category so the user-visible placeholder reads well.

Wiring it up has four integration points:

- Publish an npm package that exports detectors in one of the three shapes above.
- List the package in your global config (`~/.config/prompt-scrub/config.json` on Linux, the equivalent on macOS and Windows) under `rulePacks`, or under the `prompt-scrub.rulePacks` key in your project `package.json`. The loader unions the two sources and de-duplicates.
- Run `prompt-scrub rules list` to verify the package was loaded. If your detector does not appear, the loader skipped it and you have a bad export shape.
- Understand the collision behaviour. The built-ins have a hard-coded priority table (`SecretDetector` is highest), so a custom detector whose finding overlaps with a credential always loses. Pick categories that do not collide.

This is a deep dive for a developer publishing their first custom detector pack. The full walkthrough, including the minimal end-to-end example (a `ProjectXDetector` that catches two internal codenames), is in the post linked from this article.

Source, tests, and the rule-pack contract: https://github.com/Nano-Collective/prompt-scrubber
