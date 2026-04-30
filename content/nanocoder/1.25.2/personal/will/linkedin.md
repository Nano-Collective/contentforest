---
product: nanocoder
version: "1.25.2"
channel: "personal:will:linkedin"
generated_at: "2026-04-30T19:44:20.504Z"
model: "minimax-m2.7"
char_count: 1055
---

v1.25.2 is out. This one is a Nix Flakes patch — two bugs that prevented `nix run` from starting Nanocoder correctly.

The first: `themes.json` and the prompt section files weren't being copied into the Nix store during the package build. Nanocoder would crash immediately on startup with a missing asset error. Fixed by adding them to the store path in the Nix expression.

The second: the wrapper script had incorrect indentation inside a heredoc. Nix's shell wrapper uses a heredoc to set up the environment before invoking the Node entry point, and the off-by-one indentation was being literal — it corrupted the shebang line. The fix was straightforward: dedent the heredoc content.

If you use Nix Flakes, the upgrade path is clean:

```bash
nix run github:Nano-Collective/nanocoder
```

No Nix? npm and Homebrew still work as always. Upgrading is worth the habit regardless.

https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.
