---
product: nanocoder
version: "1.29.0"
channel: linkedin
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-07-28T14:20:51.118Z"
---

Nanocoder v1.29.0 is out, and the headline is a native VS Code GUI: the extension now spawns and drives `nanocoder --acp` itself, so there is nothing to run in a terminal. Responses stream into a sidebar webview with collapsible thinking, tool activity renders as live cards, and file edits open in VS Code's diff viewer. Sessions persist, and a resumed thread looks like the conversation you left, not an empty screen.

Three other additions sit alongside it. You can press `Ctrl+S` to attach to a running subagent session and watch what it is doing in real time, with `Esc` to detach. A new `PrivacyContext` scrubs sensitive content out of prompts before they leave your machine, with a `/privacy` command to inspect what is being scrubbed. Each development mode (normal, auto-accept, yolo, plan) can now have its own provider and model, so the cheap local model you chat with is not the one you accidentally burn through on a long refactor.

The TUI also got a lot of attention this cycle. Dual screen modes render correctly, multiline cursor navigation and word-jump work in the input box, the `/model` picker has fuzzy search and a bounded scrolling window, the `/settings` dialog is tabbed and searchable, and command suggestions appear as soon as you type `/`. `Ctrl+S` cycles through parallel subagents reliably. Image attachments now leave an `[Image #N]` placeholder in the message instead of being silently stripped.

A few smaller things worth knowing: `--resume` and `--continue` CLI flags for session resumption, a `/doctor` command to surface common configuration problems, a `/retry` command to re-run the last turn, a `--json` output flag for the non-interactive run path, and PDF/DOCX support in `read_file`. The client is now stateless with history-boundary rehydration, semantic memory has its storage layer in place, and Together AI plus Thesean AI are added as first-class provider templates.

Full release notes and changelog at https://github.com/Nano-Collective/nanocoder.

Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.