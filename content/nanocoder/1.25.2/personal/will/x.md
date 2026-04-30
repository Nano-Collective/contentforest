---
product: nanocoder
version: "1.25.2"
channel: "personal:will:x"
generated_at: "2026-04-30T19:44:20.504Z"
model: "minimax-m2.7"
char_count: 268
---

v1.25.2: fixed two Nix Flakes bugs.

themes.json and prompt files weren't in the Nix store — crash on startup. Wrapper script heredoc indentation broke the shebang.

`nix run github:Nano-Collective/nanocoder` works now.

https://github.com/Nano-Collective/nanocoder #LocalAI
