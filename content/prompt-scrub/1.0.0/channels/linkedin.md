---
product: prompt-scrub
version: "1.0.0"
channel: linkedin
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 1847
---

We just shipped the first public release of `prompt-scrub`, a small Node.js utility from the Nano Collective that does one thing: it strips identifying content out of prompts and messages before they leave your machine, and rehydrates the model's response back to the original values locally.

It is local-first, runs in your own process, and ships with detectors for emails, phone numbers, postal addresses, paths, secrets (API keys, tokens, common credential shapes), and URLs, with name and code-tell detectors available as opt-ins. A small CLI wraps the same logic, with an `inspect` command that shows exactly what would change before you commit to sending anything.

The shape we care about:

- `scrub()` turns `alice@example.com` into `Email_1` and returns a session id.
- `rehydrate()` swaps `Email_1` back to `alice@example.com` once the response comes back, and surfaces unknown placeholders as warnings so you can decide whether to trust them.
- The mapping is deterministic per session, which keeps provider prompt-cache prefixes byte-stable.
- The session map lives in your OS config directory, written atomically with restrictive permissions.

This is partial defence, not anonymity. `prompt-scrub` does not address stylistic fingerprinting, semantically identifying questions, or anything at the network and key layer. We say so explicitly in the Threat Model, because a user who believes the tool makes them anonymous is worse off than one who never used it. Always run `inspect` first.

Install:

```
npm install -g @nanocollective/prompt-scrub
```

Source, full docs, and the Threat Model: https://github.com/Nano-Collective/prompt-scrubber

This is the first public release. We want to hear what detectors are missing, how rule packs should be packaged, and whether the Threat Model is clear enough. Issues and PRs at the repo.
