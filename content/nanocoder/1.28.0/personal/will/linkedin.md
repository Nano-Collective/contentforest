---
kind: personal
member: will
channel: linkedin
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T19:50:25.972Z"
model: "minimax-m3"
char_count: 1810
---

Despite a busy week, we shipped Nanocoder v1.28.0 🔥

This one's a big one for us. Three things landed that I'm genuinely excited about:

1) ACP support. Run `nanocoder --acp` and Zed (or any ACP-compatible editor) becomes the UI. Streaming text, diffs, permission prompts, model switching, all rendered natively inside the editor instead of the terminal. Two lines in `settings.json` and you're driving Nanocoder from your editor.

2) Tool surface consolidated from 33 tools down to 19. Tasks, file ops, and git all collapsed into cleaner primitives. A new auto tune profile picks the right toolset for your model automatically, so small local models get the slim prompt and shorter tool list without you configuring anything.

3) Session resume now replays the full message and tool-call history into the chat view. You pick up exactly where you left off, conversation visible, not an empty screen.

Underneath that: schema-validated tool calls, a `/copy` command for the last assistant response, two new providers (Atlas Cloud and Requesty), safer local-model defaults for unattended local models, and a skill linter that catches malformed bundles before they ship.

Roughly 6.3k lines went out with the consolidation alone.

Massive credit to the team as always: Brijesh K R, Deniz Okcu, Nassim Amar, Matthew Spence, Alexandru Spînu. Plus a long list of community contributors who made this release what it is, including @Avtrkrb on ACP, @akramcodez on session resume, and many more across providers, fixes, and docs.

Nanocoder continues to be a strong contender in AI-driven software development, and we're very proud to keep it open source, local-first, and community-built.

Full release notes: https://github.com/Nano-Collective/nanocoder

Very excited for what's next 🔥

#nanocoder #opensource
