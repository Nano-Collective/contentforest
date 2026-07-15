---
product: prompt-scrub
version: "1.0.0"
channel: reddit
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 2962
distributed_at: "2026-07-15T18:21:53.415Z"
---

We just shipped the first public release of `prompt-scrub`, and we want to talk about it.

`prompt-scrub` is a small Node.js utility that runs entirely on your machine. You give it a prompt, it detects identifying content (emails, phone numbers, postal addresses, paths, secrets, URLs, with name and code-tell as opt-ins), replaces each finding with a stable placeholder like `Email_1` or `Path_2`, and gives you back the scrubbed text plus a session id. You send the scrubbed text to whichever LLM provider you already use. When the response comes back, you hand it to `rehydrate()` with the session id and the placeholders are swapped back to your real values. That is the whole shape.

We built it because most accidental identifier leakage to a cloud LLM is right there in the text of the prompt. Stripping it locally, deterministically, before the prompt leaves your machine seemed like a useful layer, and one that did not need a hosted service or a new account to work.

A few choices worth flagging:

- It is deterministic per session. The same input and session id produce the same scrubbed output every time, which is what you want if your provider caches prompt prefixes.
- The session map is a small JSON file under your OS config directory, written atomically with restrictive permissions. If the file gets corrupted, it gets quarantined rather than silently disabling rehydration.
- The `inspect` command prints what would change without writing a session file, plus a SHA-256 hash of the scrubbed output so you can verify cache stability across runs.
- Eight detectors ship in the box. Six are on by default; the name and code-tell detectors are opt-in because their false-positive cost is higher.
- Rule packs let you publish additional detectors as separate npm packages.

What it is not:

- Anonymity. A question that is inherently identifying (your private codebase, a niche bug only you have, a number only your accountant knows) cannot be made anonymous by stripping identifiers.
- Style rewriting. The way you phrase things goes out unchanged.
- Network protection. Your IP, request timing, and headers are outside the tool's scope.

We state all of this explicitly in the Threat Model. A user who believes the tool makes them anonymous is worse off than one who never used it, because they stop reading their prompts. Always run `inspect` first.

Install:

```bash
npm install -g @nanocollective/prompt-scrub
```

Source, docs, and the Threat Model: https://github.com/Nano-Collective/prompt-scrubber

This is our first public release at 1.0.0, and the thing we most want feedback on right now is detector coverage (what common shapes do you paste in that we are missing?), rule-pack packaging (the extension shape is in, but we have not yet seen real-world rule packs), and the Threat Model framing. Issues and PRs at the repo.

We hang out in the Nano Collective Discord if you want to talk about any of it: https://discord.gg/ktPDV6rekE