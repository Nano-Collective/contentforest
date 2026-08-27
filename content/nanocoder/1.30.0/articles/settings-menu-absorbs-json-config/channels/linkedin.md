---
product: nanocoder
version: "1.30.0"
channel: linkedin
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 2907
---

Most of Nanocoder v1.30.0 is consolidation, and the largest piece is `/settings`. We walked through the design in a longer write-up; this is the short version.

Six tabs now hold what used to be scattered across `agents.config.json`, `nanocoder-preferences.json`, `/setup-providers`, `/setup-mcp`, and the in-app editors.

**Appearance, Input, Behavior** are the surfaces you tune once and forget: theme, title shape, paste threshold, notifications, default mode, auto-compact, sessions, reasoning-trace defaults, the tool-results and thinking sub-panel, and tool auto-approval.

**Providers** and **MCP** are the two configuration surfaces with their own setup wizards behind them. The big change is that edits made here apply to the running session instead of waiting for the next launch. Adding an MCP server mid-conversation is now a single menu operation, not a restart.

**Advanced** holds the power-user rows: privacy toggle, the in-app JSON editor for `agents.config.json`, and a read-only view of the active `NANOCODER_*` environment variables (with credential masking for anything matching KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, or AUTH). Plus the action rows for Tune Model and Connect IDE.

The JSON editor is a tree editor, not a text editor. The cursor lands inside the quotes when you edit a string; booleans are picked with the arrow keys; saves write atomically via temp-file-then-rename. A crash mid-write cannot leave a half-written config. Unsaved edits live only in the viewer's state, so exiting without pressing `w` discards them with no keep/discard prompt.

`/setup-providers` and `/setup-mcp` are retired. Both names still work for now and emit a notice pointing at the matching `/settings` tab. The autocomplete list no longer offers them.

The wizard itself was reshaped separately: pressing `d` in the model list no longer drops you on a template page where the only way to finish was scrolling past every template to an off-screen "Done & Save". It now lands on the root menu, which offers Done and Save up front. Mode-specific providers are now opt-in from the provider menu instead of being interposed between Done and Save and the summary.

The selector UI uses `StyledSelectInput` everywhere it lists items, which fixes the hardcoded `blue` highlight from `ink-select-input` that disappeared on dark terminals, and uses the theme's `primary` colour instead. Five light themes (cherry-blossom, ayu-light, everforest-light, volcanic-ash, solarized-light) were also raised to a 3:1 WCAG AA contrast floor against the theme's `base` colour, with a CI test that fails the build if a theme falls below the threshold.

The JSON editor is the escape hatch for everything the menu doesn't cover yet. As dedicated panels are added for settings, their keys move out of "edit this by hand" and into the menu.

Full write-up and source: https://github.com/Nano-Collective/nanocoder.