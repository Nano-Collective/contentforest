---
product: nanocoder
version: "1.25.2"
channel: linkedin
generated_at: "2026-04-30T19:44:20.504Z"
model: "minimax-m2.7"
char_count: 1511
---

Nanocoder v1.25.2 is out. This patch fixes two bugs that were breaking the Nix Flakes installation path — if you use `nix run` to launch Nanocoder, this release resolves the startup crashes.

The first bug: during the Nix package build, `themes.json` and the prompt section files were not being copied into the Nix store. Nanocoder would crash immediately on startup with a missing file error. The fix adds these files to the store path in the Nix expression.

The second bug: the Nix wrapper script had a heredoc indentation issue that corrupted the shebang line (`#!`) in the generated launch script. Nix builds a shell wrapper at packaging time to set up the runtime environment, and the off-by-one indentation inside the heredoc was being embedded literally into that script — preventing it from executing at all.

Both issues were specific to the Nix Flakes path. npm and Homebrew were unaffected. If you run Nanocoder via Nix, `nix run github:Nano-Collective/nanocoder` should now start cleanly.

Upgrade for other package managers:

```bash
npm install -g @nanocollective/nanocoder
# or
brew update && brew upgrade nanocoder
```

Try it: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.
