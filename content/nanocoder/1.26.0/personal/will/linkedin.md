---
kind: personal
member: will
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-10T21:59:28.274Z"
model: "minimax-m3"
char_count: 2061
---

Nanocoder 1.26.0 is out 🔥

This one is a big release. Three things that I'm genuinely excited about:

First: Nano mode. A new tool profile under /tune built for running Nanocoder on modest hardware with small open-weights models. We're talking system prompts down to 150-250 tokens instead of 500-700, with a hardware-tuned preset and an AGENTS.md toggle. If you've been watching from the sidelines waiting for a local setup that actually works, this is close.

Second: reasoning traces are now rendered in real time. Thought blocks collapse and expand, persist across your session history, and log correctly. Control+R toggles expansion. It changes how you follow what the model is actually doing.

Third: a --plain flag for non-interactive mode. Clean stdout for CI pipelines and scripts. Deterministic exit codes. Exactly what a lot of you have been asking for.

Beyond those, we've also completely overhauled the VS Code extension, added /rename for chat sessions, custom system prompts, a defaultMode config option, per-provider context window overrides, a disabledTools config option, a new Display Settings panel, and 12+ new themes.

This one was a serious team effort. Credit where it's due: Brijesh K R, Deniz Okcu, Nassim Amar, Matthew Spence, Alexandru Spînu. We've been pushing hard and it shows.

More soon.

nanocollective.org/nanocoder
