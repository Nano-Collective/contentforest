---
product: nanocoder
version: "1.25.2"
channel: reddit
generated_at: "2026-04-30T19:44:20.504Z"
model: "minimax-m2.7"
char_count: 1201
---

Nanocoder v1.25.2 is out. This one is a small patch, but if you use Nix Flakes to run Nanocoder, it's worth updating — we fixed two bugs that were preventing `nix run` from starting cleanly.

**The short version of what broke:**

The Nix package build wasn't including `themes.json` and the prompt section files in the Nix store. Nanocoder would crash immediately on startup with a missing asset error.

Separately, the Nix wrapper script had a heredoc indentation issue. Nix generates a shell launch script at build time, and the off-by-one indentation inside the heredoc was being embedded literally — corrupting the shebang line and preventing execution.

**What this means for you:**

If you use Nix Flakes, `nix run github:Nano-Collective/nanocoder` should now start correctly. These issues were specific to the Nix path — npm and Homebrew users weren't affected.

**Quick upgrade:**

```bash
# npm
npm install -g @nanocollective/nanocoder

# Homebrew
brew update && brew upgrade nanocoder

# Nix
nix run github:Nano-Collective/nanocoder
```

We're the Nano Collective — open source, community-run, no profit motive. Repo link below if you want to take a look or file an issue.

https://github.com/Nano-Collective/nanocoder
