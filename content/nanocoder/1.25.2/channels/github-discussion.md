---
product: nanocoder
version: "1.25.2"
channel: github-discussion
generated_at: "2026-04-30T19:44:20.504Z"
model: "minimax-m2.7"
char_count: 2278
---

# Nanocoder v1.25.2 Released

v1.25.2 is a patch release that fixes two bugs affecting Nix Flakes users. If you run Nanocoder via `nix run`, this release resolves the startup crashes that were occurring.

## What Changed

### Nix package fixes

Two bugs were preventing `nix run github:Nano-Collective/nanocoder` from starting Nanocoder correctly:

1. **`themes.json` and prompt section files were missing from the Nix store.** The Nix package build was not copying these assets into the store, so Nanocoder crashed immediately on startup with a missing file error. Both files are now included correctly.

2. **Wrapper script heredoc indentation was breaking the shebang line.** The shell wrapper that launches the Node entry point had incorrect indentation inside a heredoc block. Because Nix interprets heredoc content literally, the off-by-one indentation was being embedded in the generated script — corrupting the shebang (`#!`) and preventing execution entirely. The indentation in the heredoc has been corrected.

These issues were specific to the Nix Flakes installation path. npm and Homebrew users were unaffected. If you use Nix Flakes and have been hitting startup errors, this release resolves them.

The Nix package uses a generated shell wrapper to set up the runtime environment before invoking the Node entry point. Both bugs were in that wrapper generation step: one in the file list passed to the builder, one in the heredoc template syntax. The fixes address the root causes rather than working around the symptoms.

## Installation methods

Nanocoder is available via three package managers:

**npm (macOS, Linux, WSL):**

```bash
npm install -g @nanocollective/nanocoder
```

**Homebrew (macOS, Linux):**

```bash
brew tap nano-collective/nanocoder https://github.com/Nano-Collective/nanocoder
brew install nanocoder
```

**Nix Flakes (macOS, Linux):**

```bash
nix run github:Nano-Collective/nanocoder
# or, if you don't have flakes enabled:
nix run --extra-experimental-features 'nix-command flakes' github:Nano-Collective/nanocoder
```

## Feedback

If you hit any issues, open an issue on the repo or drop a message in Discord. Thanks for using Nanocoder.

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.
