---
product: nanocoder
version: "1.32.0"
channel: linkedin
title: "Nanocoder plugins: JavaScript that can veto a tool call from inside the agent"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 1545
---

Nanocoder v1.32.0 ships in-process plugins: a JavaScript file in `.nanocoder/plugins/` that runs inside the agent, not as a shell command beside it.

Lifecycle hooks already let you veto a tool call, but a hook is a shell script. It talks in exit codes and `NANOCODER_*` environment variables, so it can say no, and it can print something, but it cannot look at the arguments as data or read the tool result.

A plugin can. There are five hooks:

- `tool.execute.before` refuses a tool call with a reason.
- `tool.execute.after` adds text to the tool result the model reads.
- `session.compacting` observes, and is deliberately observe-only.
- `tui.prompt.append` prepends context to your prompt.
- `permission.asked` denies an approval prompt outright, so the prompt is never shown.

The last one has no shell-hook equivalent, and it is the interesting one. A plugin can refuse a tool that was about to ask for your approval. It cannot do the reverse: there is no allow decision, and a plugin that returns one is logged and treated as a defer. A plugin cannot register tools either.

The safety contract is the part worth trusting. Plugins load only in a directory you have trusted, and the trust fingerprint covers the plugin files, so editing one brings the prompt back. A plugin that throws, returns the wrong shape, or hangs is logged and ignored rather than blocking the agent, and one that never finishes loading is skipped after 30 seconds while the files after it still load.

Docs and repo: https://github.com/Nano-Collective/nanocoder
