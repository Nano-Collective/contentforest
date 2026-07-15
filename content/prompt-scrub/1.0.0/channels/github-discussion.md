---
product: prompt-scrub
version: "1.0.0"
channel: github-discussion
title: "prompt-scrub v1.0.0: a local-first scrubber for prompts and their responses"
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 8920
distributed_at: "2026-07-15T09:40:35.674Z"
---

# prompt-scrub v1.0.0: a local-first scrubber for prompts and their responses

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

This is the first public release of `prompt-scrub`, a small Node.js utility that runs entirely on your machine. It detects identifying content inside a prompt (emails, paths, secrets, phone numbers, URLs, postal addresses, and a couple of opt-in categories), replaces each finding with a stable placeholder like `Email_1` or `Path_2`, and lets you rehydrate the model's response back to the original values locally after it comes back.

The motivation is simple: most accidental identifier leakage to a cloud LLM lives in the text of the prompt and the text of its response. Stripping it there, deterministically, before the prompt leaves your machine is a useful layer in a privacy posture, and one that does not need a network round-trip, a new account, or a hosted service to work.

## What it actually does

The package exposes two functions and a CLI.

`scrub()` takes either a plain string or an array of `{ role, content }` messages, runs the configured detectors over the text, replaces each finding with a category-namespaced placeholder, and returns the scrubbed content plus a session id:

```typescript
import { scrub, rehydrate } from '@nanocollective/prompt-scrub';

const prompt = "My key is sk-12345 and my email is alice@example.com";
const { scrubbedContent, sessionId } = scrub({ content: prompt });
// scrubbedContent: "My key is Secret_1 and my email is Email_1"
```

You send `scrubbedContent` to whatever LLM provider you already use. When the response comes back, `rehydrate()` walks the text, looks up each placeholder in the session map, and swaps them back. Unknown placeholders (placeholder text the model hallucinated, or placeholders from a previous session) are passed through unchanged and surfaced as warnings so you can decide whether to trust them:

```typescript
const response = "Your email Email_1 looks correct and your key Secret_1 is fine.";
const { content, warnings } = rehydrate({ content: response, sessionId });
// content: "Your email alice@example.com looks correct and your key sk-12345 is fine."
```

The session id is the link between the two steps. It points at a small JSON file under your OS config directory that holds the placeholder-to-original mapping. The file is written atomically, with restrictive permissions, and includes a corrupt-file quarantine path so a half-written map does not silently disable rehydration. The location is overridable via the `PROMPT_SCRUB_CONFIG_DIR` environment variable.

## Detectors

Eight detectors ship in the box.

On by default:

- email
- phone
- postal address
- path (Unix-style and Windows-style)
- secret (tuned for common API key and credential shapes, since missing a credential is worse than missing a name)
- url

Off by default, opt-in:

- name (proper-noun detector, with a stricter allowlist mode)
- code-tell (user-enumerated private identifiers, for things like internal project codenames)

URL detection also accepts a trusted-host allowlist with subdomain matching, so internal services you control can pass through without a placeholder if that is what you want. Overlapping detector findings (an email that looks like a URL fragment, say) resolve by a documented priority order, with longer span winning on ties. Determinism is deliberate: the same input and session always produce the same scrubbed output, which keeps provider prompt-cache prefixes byte-stable.

## The CLI

A small command-line wrapper around the same logic. The recommended workflow is `inspect` first, then `scrub`:

```bash
# See exactly what would change without writing anything
echo "My email is alice@example.com" | prompt-scrub inspect

# Scrub stdin (or a file), prints the session id to stderr
echo "My email is alice@example.com" | prompt-scrub scrub

# Rehydrate a response using --session-id
echo "Contact Email_1 for details." | prompt-scrub rehydrate --session-id <id>

# Inspect a session map
prompt-scrub sessions list
prompt-scrub sessions show <id>

# See the active detector set, including any rule-pack additions
prompt-scrub rules list
```

`inspect` is the part we want people to actually use. It does not write a session file and it prints a SHA-256 hash of the scrubbed output so you can verify byte-stable cache prefixes across runs:

```
Detected entities:
  [Email]    alice@example.com                → Email_1    (chars 12-29)

No session written.
Hash: 41beda4af0b83488fdf6eea9347775450a1c7c887a6ef377212340f36c445132
```

## Extensibility

Two extension points:

- Custom detectors can be passed in via the library API (`customDetectors` in `ScrubOptions`). Each one returns matches in the same shape the built-ins do, so they slot into the same priority / span logic.
- Rule packs are separate npm packages that contribute additional detectors. They are declared in your config or in `package.json`, merged into the active set, and visible in `rules list`. This is the path for sharing detectors across projects without forking the package.

## What this is, and what it is not

`prompt-scrub` reduces identity leakage at the content layer. It is partial defence, not anonymity, and the README and the [Threat Model](https://github.com/Nano-Collective/prompt-scrubber/blob/main/docs/features/threat-model.md) are explicit about the distinction because the distinction matters.

It does defend against:

- Accidental secret leakage in prompts. The secret detector is tuned for high precision on the common API key, token, and credential shapes.
- Accidental identifier leakage in one-off prompts. Emails, phone numbers, postal addresses, paths, and URLs are caught with conservative defaults, and the original values stay on disk under the session map.

It partially mitigates:

- Cloud LLM providers reading identifying content. After scrubbing, the prompt contains `Email_1` instead of your address. That is materially less identifying, but not zero, and a determined provider can still correlate across a session if it has access to its own logs.
- Long-term profile building from prompt content. Stable session mappings prevent identifier-level correlation within a single session. They do not address stylistic fingerprinting, the way you phrase things goes out unchanged.
- Tool call results in agentic settings. The scrubber runs on every message regardless of origin, so `ls`, `git log`, `cat`, and `grep` outputs are scrubbed before the next LLM turn. Coverage is limited to the configured detectors.

It does not defend against:

- A compromised local machine. The scrubber runs locally. If your environment is compromised, your prompt is too. The session maps on disk are plaintext JSON in v1, and an attacker with your account can read them. Encryption at rest is a v1.1 follow-up.
- Semantic leakage. A question that is inherently identifying (your private codebase, a niche bug only you have, a number only your accountant knows) cannot be made anonymous by stripping identifiers.
- Stylistic fingerprinting. The v1 brute-force approach does not rewrite style.
- The network or key layer. Your IP address, request timing, and headers are outside the scrubber's scope. Pair it with a network tool of your own choosing if you need that.

A user who believes this tool makes them anonymous is worse off than one who never used it, because they stop reading their prompts and trust the defaults. Always use `inspect` first. The Threat Model document spells out the full picture in one place.

## Install

```bash
# As a global CLI
npm install -g @nanocollective/prompt-scrub

# As a Node.js dependency
npm install @nanocollective/prompt-scrub
```

The package is open source under the project's licence. Source, full docs, and the Threat Model live at the repo:

https://github.com/Nano-Collective/prompt-scrubber

## Feedback wanted

This is the first public release. The things we would most like to hear about:

- Detector coverage. Which common shapes do you paste in that we are missing? Which opt-in category (name, code-tell) should be on by default for your workflow?
- Rule pack packaging. The extension shape is in, but we have not yet seen real-world rule packs, and the format is open to change while the package is at 0.x.
- The Threat Model. We chose partial-defence framing deliberately. If the documentation is unclear about what is and is not defended, we want to know before we ship more code on top of it.
- The inspect UX. The hash output and the dry-run diff are intended to be the thing people actually use. If they are awkward in practice, that is a fast fix.

Issues and PRs are welcome at the repo. There is also a [Nano Collective Discord](https://discord.gg/ktPDV6rekE) for the wider conversation about what the collective is building and why.
