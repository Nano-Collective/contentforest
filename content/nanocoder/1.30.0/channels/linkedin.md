---
product: nanocoder
version: "1.30.0"
channel: linkedin
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 1796
---

Nanocoder v1.30.0 is out. The theme of this release is consolidation, and most of the work is about giving users more control over their day-to-day flow without leaving the terminal.

Almost every remaining CLI setting now lives inside `/settings`. You can set the default mode, auto-compact, sessions, reasoning traces, tool auto-approval, and a Web Search API key; view your configured providers and MCP servers before opening the setup wizards; and edit `agents.config.json` directly in an in-app JSON editor that saves atomically. `/setup-providers` and `/setup-mcp` are sunset in favour of `/settings`; the old names still work but now open the matching tab with a notice.

A new `/commit` slash command generates Conventional Commit messages from your staged Git diffs using the active LLM. `/commit --copy` (or `-c`) copies the generated message to the clipboard, and a spinner shows while the model thinks so the round-trip is no longer a silent pause.

Every assistant response in the CLI now ends with a subtle gray footer showing provider-reported token usage and an estimated cost, computed from models.dev pricing. The cost segment is omitted for local and free models. The same indicator appears under finished responses in the VS Code extension. The footer is optional and can be turned off under `/settings` → Behavior → Tool Results and Thinking.

The VS Code extension saw the most user-visible changes this cycle. Context attachment now supports file and folder chips with drag-and-drop, plus a consolidated `+` menu for uploads and image pasting for multimodal messages. Typing `@` in the chat composer opens a floating dropdown of workspace files, folders, and open editors, with attached files capped at 100 KB so a mis-picked lockfile can no longer swallow the context window. Editor code lenses on every function, method, constructor, and class now offer `Explain Code` and `Generate Tests` links.

Tool results stay inside the context window: `execute_bash` truncates output tail-weighted, oversized tool results are bounded before they re-enter context, and `string_replace` and `diff_edit` results are now bounded to a context window around the edited range.

Groq and OrcaRouter join the setup wizard as first-class provider templates, and the Atlas Cloud wizard now stores provider-qualified GPT-5.6 model IDs. Fixes cover Copilot reasoning-model streaming, the VS Code stop button, Windows CLI startup, Node version manager resolution, IPv6 loopback in the SSRF guard, and many more.

Full changelog and docs at https://github.com/Nano-Collective/nanocoder.