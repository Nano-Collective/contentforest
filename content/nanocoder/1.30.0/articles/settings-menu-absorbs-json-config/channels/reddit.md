---
product: nanocoder
version: "1.30.0"
channel: reddit
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 8131
---

We shipped the `/settings` rebuild in Nanocoder v1.30.0 and figured folks might want the design notes underneath the headline. Here's the walkthrough.

## The six tabs

Settings live in `source/app/components/settings-tabs.tsx`, in one `buildRowsForTab` function with one switch arm per tab. Three rough audiences:

- **Appearance** and **Input** are about the terminal surface. Theme, title shape, nanocoder shape, alternate-screen buffer, paste threshold, notifications.
- **Behavior** is about the agent itself: tool-result and thinking-trace defaults, default mode, auto-compact, sessions.
- **Providers** and **MCP** are the configuration surfaces with their own setup wizards behind them.
- **Advanced** is power-user land: privacy toggle, raw JSON editor, the environment viewer, plus the action rows for Tune Model and Connect IDE.

Each row is one of four shapes: a boolean toggle (Alternate Screen), a number (Paste Threshold), a managed panel that opens a sub-screen on Enter, or an action that launches an app-level wizard. The selector searches across rows with a fuzzy filter when the user starts typing in the box at the top.

The search box and the tab bar all live in one rounded-border Box; the row list is a sibling, so changing the search width doesn't shift the rows underneath.

## The selector got a theme fix

Every selector in the app now goes through `StyledSelectInput`. That's a thin wrapper around `ink-select-input` that fixes two things the upstream got wrong:

1. The default selected-row indicator and label colour are a hardcoded `blue` that all but disappears on dark terminals. The wrapper uses the theme's `primary` colour and a fixed-width `>` indicator in a `<Box minWidth={2}>`, so truncated rows don't shift one column left of short ones.
2. Long labels used to wrap with no hanging indent and read as a jumble on narrow terminals. The wrapper truncates rather than wraps.

The contract is enforced by a test in `source/config/themes.spec.ts`: `primary` contrasts at least 3:1 against `base` in every theme, and `text` contrasts at least 4.5:1. Both use relative luminance per WCAG 2.1. Five themes were raised to the threshold this release: cherry-blossom, ayu-light, everforest-light, volcanic-ash, solarized-light. The test runs in CI, so a theme that falls below now breaks the build.

## The in-app JSON editor

Advanced → Edit Config Files opens the JSON editor on `agents.config.json`. It's `JsonViewer` in `source/components/json-viewer/json-viewer.tsx`, a tree editor, not a text editor.

Navigation is j/k or arrow keys. Pressing `e` or Enter on a scalar enters edit mode. Two design choices worth calling out:

**The cursor lands inside the quotes.** When you press `e` on a string row, the input element renders inside the existing `"..."` rather than as a separate field below. The string is pre-stripped of its surrounding quotes, and committing re-wraps the typed string. You don't remove and re-add the quotes by hand.

**The write is atomic.** The save handler is `writeConfigFileAtomic(filePath, data)` in `source/config/config-writer.ts`. The primitive:

```ts
const tmpPath = `${filePath}.${randomUUID()}.tmp`;
writeFileSync(tmpPath, data, 'utf-8');
renameSync(tmpPath, filePath);
```

`rename` on the same filesystem is atomic on every platform Nanocoder ships on (POSIX guarantees it; Windows since libuv uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`). If the write throws partway, the temp file is unlinked and the original is untouched. A crash mid-save cannot leave a half-written config.

Unsaved edits live only in the viewer's state. Exiting via `q`, Esc, or Shift+Tab discards them. There's no keep/discard prompt because there's no save to roll back from. The file is only written when the user opts in by pressing `w`. A dirty indicator (`● modified`) and a warning-coloured inner border show while modified, so the user always knows whether `w` would do anything.

## Providers and MCP apply live

Both the Providers and MCP tabs list the configured entries and let you edit or delete any of them by opening the matching wizard. The wizard changes apply to the running session instead of waiting for the next launch.

`onProvidersChanged` rebuilds the client for the current provider/model without clearing messages, so swapping providers mid-conversation keeps the history. `onMcpChanged` rebuilds the running session's MCP connections, so adding a server mid-session makes it live immediately.

## The wizard reshape

Two specific complaints drove the wizard changes, separately from the `/settings` move.

**`d` in the model list dropped you on the raw provider template list.** The only way to finish was scrolling past every template to a trailing "Done & Save", off-screen on a normal terminal. The wizard looked hung. After the fix, `d` (model-list back) lands on the wizard's root menu, which offers Done and Save up front.

**Mode-specific providers interposed themselves between Done and Save and the summary.** A first run with no mode providers configured still walked through that screen, which had nothing to say to that user. After the fix, mode-specific providers are an opt-in entry in the provider menu. Picking it goes to the mode step; finishing returns to the provider menu. Done and Save from the provider menu goes straight to the summary, carrying any mode providers already configured through a save that skips the step.

The provider menu is the hub: Add another provider, Edit existing providers, Configure mode-specific providers, Done and Save. A first run sees three; a returning user sees all four.

## The retired names still work

`/setup-providers` and `/setup-mcp` are retired. They still work but emit an info notice and open the matching `/settings` tab. The mapping lives in `source/app/utils/app-util.ts`:

```ts
const RETIRED_SETUP_COMMANDS: Record<string, SettingsTabId> = {
  'setup-providers': 'providers',
  'setup-mcp': 'mcp',
};
```

The autocomplete list no longer offers them as suggestions. Users with the old names in muscle memory get a working command and a hint, not a dead end.

`/settings` itself takes a tab argument (`/settings providers`, `/settings mcp`). Unknown tab names error with a message that lists the valid set, drawn from `SETTINGS_TAB_IDS` so adding a tab without updating the message is a compile error.

## The `NANOCODER_*` environment viewer

Advanced → Environment shows the active `NANOCODER_*` environment variables, read-only. The panel sorts them alphabetically and renders each as `KEY=value` with the key in the theme's `primary` colour.

There's a credential mask. A regex on the variable name matches KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, or AUTH. Matching values keep the first four characters and replace the rest with up to 12 asterisks. `NANOCODER_PROVIDERS_FILE=/home/runner/projects/x.json` reads verbatim; `NANOCODER_BRAVE_SEARCH_API_KEY=abcd1234...` reads `abcd************`. Someone screen-sharing a settings walkthrough doesn't accidentally leak a credential by opening this panel.

The panel surfaces things like `NANOCODER_CONFIG_DIR`, `NANOCODER_CONTEXT_LIMIT`, `NANOCODER_PROVIDERS` (and `_FILE`), `NANOCODER_MCPSERVERS` (and `_FILE`), and the logging set. It's read-only by design: environment variables are set externally and override config files.

## What's still in the file

Not everything is reachable from the menu. Things that are still file-only, by design:

- Custom system prompt content (`nanocoder.systemPrompt.content` or `file`).
- Headless limits (`nanocoder.headless.maxTurns`, `NANOCODER_MAX_TURNS`).
- Anything beyond a name/command/url/transport pair for providers and MCP.
- The environment overrides for providers and MCP themselves (`NANOCODER_PROVIDERS`, `NANOCODER_MCPSERVERS`).

The JSON editor at Advanced → Edit Config Files is the escape hatch for all of these. As dedicated panels are added for a setting, its key moves out of "edit this by hand" and into the menu.

Source and docs: https://github.com/Nano-Collective/nanocoder. Anything broken or missing, an issue or a Discord note is the fastest way to reach us.