---
product: nanocoder
version: "1.30.0"
channel: github-discussion
title: "How /settings ate the JSON config (and what stayed in code)"
generated_at: "2026-08-27T09:50:38.257Z"
model: "minimax-m3"
char_count: 15907
---

The headline change in Nanocoder v1.30.0 is consolidation: almost every remaining CLI setting now lives inside `/settings`, grouped into Appearance, Input, Behavior, Providers, MCP, and Advanced tabs. The release post covers the shape of that move. This article walks through the design decisions underneath: why the tabs are split the way they are, what the in-app JSON editor actually does when you press `w`, how the `NANOCODER_*` environment viewer decides what to show, and the parts of the old setup wizard that survived the rewrite, in reshaped form.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source: [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## The tab split

The six tabs map onto three different audiences. **Appearance** and **Input** are about the terminal surface: theme, title shape, nanocoder shape, alternate-screen buffer, paste threshold, notifications. **Behavior** is about how the agent itself runs: tool-result visibility and thinking-trace defaults, default mode, auto-compact, sessions. **Providers** and **MCP** are the two configuration surfaces with their own setup wizards behind them; **Advanced** holds the things that exist for power users (privacy toggle, raw JSON editor, the environment viewer, plus the Tune Model and Connect IDE action rows).

Concretely, the rows are defined in a single function in `source/app/components/settings-tabs.tsx`, one switch arm per tab:

- **Appearance** lists Theme, Title Shape, Nanocoder Shape, and an Alternate Screen boolean.
- **Input** lists Paste Threshold (a number) and Notifications (managed).
- **Behavior** lists Tool Results and Thinking, Reasoning Traces, Default Mode, Auto-Compact, and Sessions.
- **Providers** lists Configure Providers (the count, e.g. "3 configured"), Web Search (whether an API key is set), and Tool Auto-Approval (the count of always-allowed tools).
- **MCP** lists Configure MCP Servers (the count).
- **Advanced** lists Privacy, Edit Config Files (which opens the JSON editor on `agents.config.json`), Environment (read-only view), and the two action rows: Tune Model and Connect IDE.

Each row is one of four shapes: a boolean toggle (Alternate Screen), a number (Paste Threshold), a managed panel that opens a sub-screen on Enter, or an action that launches an app-level wizard (Tune, Connect IDE). The same function returns a fresh `SettingRow[]` per tab, and a fuzzy filter ranks rows by label and id when the user starts typing in the search box at the top.

That last point matters for the reshape. The selector isn't a flat list of every preference; each preference must be reachable from exactly one tab. The tabs themselves are the discovery surface. A user who wants to know where "auto-compact" lives can find it from `Behavior`. A user looking for the providers file path can find it from `Advanced → Edit Config Files`.

## The selector UI, and the theme contrast fix

The selector uses `StyledSelectInput` everywhere it lists items. `StyledSelectInput` is a thin wrapper around `ink-select-input` that fixes two things the upstream component got wrong:

1. The default selected-row indicator and label colour are a hardcoded `blue` that all but disappears on dark terminals. The wrapper replaces the indicator with a fixed-width `>` rendered in the theme's `primary` colour, and a default `itemComponent` that paints the selected label in `primary` and unselected rows in `text`. Both pull from `useTheme()`.
2. Long labels used to wrap with no hanging indent and read as a jumble on narrow terminals. The wrapper truncates rather than wraps, and the indicator lives in a `<Box minWidth={2}>` so truncated rows don't shift one column left of short ones.

The theme contrast test sits in `source/config/themes.spec.ts` and is what guarantees this isn't an aesthetic choice that regressed silently. Two assertions:

- `primary` (the selection highlight) contrasts at least 3:1 against `base` in every theme.
- `text` (body text) contrasts at least 4.5:1 against `base` in every theme.

Both use relative luminance per WCAG 2.1. 3:1 is the WCAG AA floor for large text and UI components. Five themes were raised to that floor this release: cherry-blossom, ayu-light, everforest-light, volcanic-ash, solarized-light. The test runs in CI; a theme that falls below the threshold now breaks the build instead of shipping.

## In-app JSON editing without a text editor

The Advanced tab's **Edit Config Files** row opens the in-app JSON editor on `agents.config.json` (the same panel can be re-targeted at other config files via the `configFileName` prop; the MCP list passes `.mcp.json` instead).

The editor is `JsonViewer` in `source/components/json-viewer/json-viewer.tsx`. It is a tree editor, not a text editor. The tree parses the JSON into nested `JsonNode`s, flattens them into a list of `JsonFlatRow`s, and gives the user j/k (or arrow keys) navigation. Pressing `e` or Enter on a scalar row enters edit mode; `a` adds a sibling; `d` deletes. Booleans are picked with the arrow keys rather than typed. The save key is `w`.

Two design choices are worth calling out.

First, **the cursor lands inside the quotes.** When you press `e` on a string row, the input element renders inside the existing `"..."` rather than as a separate field below. The string is pre-stripped of its surrounding quotes (`setEditValue(currentRow.value.replace(/^"|"$/g, ''))`), the edit input sits where the value was, and committing re-wraps the typed string. Editing a JSON string no longer means remembering to remove and re-add the quotes by hand.

Second, **the write is atomic.** The save handler is `writeConfigFileAtomic(filePath, data)` from `source/config/config-writer.ts`. The implementation:

```ts
function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmpPath, data, 'utf-8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch {}
    throw error;
  }
}
```

The temp file lives next to the target, gets the real content, and only then does `renameSync` swap it in. `rename` on the same filesystem is atomic on every platform Nanocoder ships on (POSIX guarantees it; on Windows `rename` over an existing target also replaces atomically since Node's libuv uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`). If the write throws partway, the catch unlinks the temp and re-throws, and the original file is untouched. A crash mid-save can't leave a half-written config, and the directory is created with `mkdirSync(dir, { recursive: true })` if missing.

Unsaved edits live only in the viewer's state. Exiting without pressing `w` (via `q`, Esc, or Shift+Tab) discards them. There is no keep/discard prompt because there's no save to roll back from. That is the rollback, by construction: the file is only written when the user opts in.

There's also a real-time dirty indicator at the top of the editor: `● modified` appears as soon as the tree diverges from `JSON.stringify(data)`, and the inner border switches to the theme's `warning` color while modified. The user always knows whether `w` would do anything.

## Providers and MCP, live

The **Providers** and **MCP** tabs do something the old `/setup-providers` and `/setup-mcp` didn't: edits apply to the running session instead of waiting for the next launch.

The provider list panel (`source/app/components/settings-providers-list.tsx`) shows each configured provider on a single row, formatted as `name · baseUrl · first model (+N)`. Pressing Enter on a row opens `ProviderWizard` on that entry's edit/delete choice. A trailing row, `+ Add a provider…`, opens the wizard with no entry targeted (i.e. add-mode). `onProvidersChanged` is awaited on wizard completion; the parent (the app shell) uses that callback to rebuild the client for the current provider/model without clearing messages. The user can swap providers mid-conversation and keep the conversation history.

The MCP list is the same shape: each server on one row as `name · transport · command|url`. Enter on a row opens `McpWizard`; the trailing row adds a new one. `onMcpChanged` rebuilds the running session's MCP connections, so adding a server here makes it live immediately instead of waiting for the next launch.

Both lists route through `StyledSelectInput`, so the theme highlight fix carries through here too.

## What the wizard reshape changed

The wizard itself was reshaped in this release, separately from the `/settings` move. Two specific complaints drove the changes.

**First, pressing `d` in the model list dropped you on the raw provider template list.** The only way to finish was scrolling past every template to a trailing "Done & Save" row, which was off-screen on a normal terminal. The wizard looked hung. After the fix, `d` (model-list back) lands on the wizard's root menu instead, which offers "Done & Save" up front.

**Second, mode-specific providers used to interpose themselves between "Done & Save" and the summary.** A first run with no mode providers configured still walked through that screen, which had nothing to say to that user. After the fix:

- "Configure mode-specific providers" is its own entry in the provider menu.
- Picking it goes to the mode step; finishing returns to the provider menu.
- "Done & Save" from the provider menu goes straight to the summary, carrying any mode providers already configured through a save that skips the step.

The provider menu is now the hub. The four rows are: Add another provider, Edit existing providers, Configure mode-specific providers, Done & Save. A first run sees exactly three (Add, Custom, Done once a provider exists); a returning user sees all four. The mode step is opt-in for everyone, which is what the change was really after.

## `/settings` takes a tab, and the old names still work

The `/settings` command now accepts a tab argument. `/settings providers` opens the Providers tab. `/settings mcp` opens the MCP tab. `/settings` with no argument opens Appearance, the first tab. Unknown tab names error with a message that lists the valid set (drawn from `SETTINGS_TAB_IDS`, so adding a tab without updating the message is a compile error).

`/setup-providers` and `/setup-mcp` are retired. They still work, but instead of erroring they emit an info notice ("`/setup-providers` has moved to `/settings`, opening the `providers` tab. Use `/settings providers` next time.") and open the matching `/settings` tab. The mapping lives in `source/app/utils/app-util.ts`:

```ts
const RETIRED_SETUP_COMMANDS: Record<string, SettingsTabId> = {
  'setup-providers': 'providers',
  'setup-mcp': 'mcp',
};
```

The autocompletion list no longer offers them as suggestions. Users with the old names in muscle memory get a working command and a hint, not a dead end.

The tab itself is a constant lookup keyed on `SettingsTabId`. The full set of tabs is `SETTINGS_TAB_IDS`; the labels are a `Record<SettingsTabId, string>` that pairs id to display name. The lazy command stub (`source/commands/settings.ts`) hands the actual work off to `SettingsSelector`, which is the component described above.

## The `NANOCODER_*` environment viewer

The Advanced tab also exposes the active `NANOCODER_*` environment variables, read-only. The panel sits at `source/app/components/settings-environment.tsx`.

The implementation walks `Object.entries(process.env)` and filters to keys starting with `NANOCODER_`, then sorts alphabetically. It renders each as `KEY=value` in `primary` and `secondary` colors respectively. Truncation is `wrap="truncate-end"` so a long value doesn't reflow onto a second line.

There is one specific guard for credentials. A regex `/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/` matches the variable name, and a matching value is masked: values 4 characters or shorter become all asterisks; longer values keep the first four characters and replace the rest with up to 12 asterisks. `NANOCODER_PROVIDERS_FILE=/home/runner/projects/x.json` reads verbatim; `NANOCODER_BRAVE_SEARCH_API_KEY=abcd1234...` reads `abcd************`. The point is that someone screen-sharing a settings walkthrough shouldn't accidentally leak a credential by opening this panel.

The variables the panel surfaces today include `NANOCODER_CONFIG_DIR`, `NANOCODER_CONTEXT_LIMIT`, `NANOCODER_DATA_DIR`, `NANOCODER_INSTALL_METHOD`, `NANOCODER_DEFAULT_SHUTDOWN_TIMEOUT`, `NANOCODER_MAX_TURNS`, the provider/MCP override pair (`NANOCODER_PROVIDERS`, `NANOCODER_PROVIDERS_FILE`, `NANOCODER_MCPSERVERS`, `NANOCODER_MCPSERVERS_FILE`), and the logging set (`NANOCODER_LOG_LEVEL`, `NANOCODER_LOG_DIR`, and so on). The panel is read-only by design: environment variables are set externally and override config files. Showing them here makes them discoverable; changing them here would be a confusing lie about where they actually come from.

## What stayed in code

Not everything in `agents.config.json` is reachable from `/settings`. Things that are still file-only, by design:

- **Provider and MCP overrides via environment variables.** `NANOCODER_PROVIDERS` and `NANOCODER_MCPSERVERS` (and their `_FILE` siblings) override the config files outright. They live in the shell environment, not the config; the environment panel shows them, but the setting is made by exporting the variable.
- **Custom system prompt content.** `nanocoder.systemPrompt.content` (or `file`) replaces or appends to the built-in prompt. Useful for small or specialized models; awkward to author in a tree editor. The settings menu doesn't touch it.
- **Headless limits.** `nanocoder.headless.maxTurns` and the `NANOCODER_MAX_TURNS` env override are non-interactive concerns, and the consumers are `--plain` and ACP. There's no live surface to expose them from.
- **Custom tools, hooks, subagents, MCP servers with non-trivial fields.** Anything beyond a name/command/url/transport pair still wants the JSON editor or a direct file edit.

The JSON editor at Advanced → Edit Config Files is the escape hatch for all of these. It's also the right place to land a new setting that doesn't yet have a dedicated panel; rather than blocking the menu move on a UI for every preference, the menu ships with the high-traffic ones and the rest stays hand-editable. As a panel is added for a setting, its `nanocoder.*` key moves out of "edit this by hand" and into the menu.

## What this changes for users in practice

A few concrete things that fall out of the reshape:

- Setting up a new provider no longer requires knowing where the config file lives. `/settings providers` → `+ Add a provider…` walks the wizard and the change is live in the current session.
- Editing the theme, paste threshold, or notifications no longer requires opening `nanocoder-preferences.json`. The setting is in the menu; the file is updated underneath.
- A misbehaving setting can be inspected via `/settings advanced → Environment` to confirm whether an env override is in play, or via `Edit Config Files` to look at the raw tree.
- A crash mid-edit of `agents.config.json` cannot leave a half-written file. The atomic rename is the same primitive the rest of the config writes use.

The release shipped these changes as one cycle because they're the same change from three angles: a menu surface, a stable editing primitive, and a consistent live-rebuild on save. Each piece is small; together they make "configure Nanocoder" mean "open the menu" for the cases most users hit, and "edit the JSON" for the cases where the menu shouldn't go.

Source and docs: [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder). If something in the menu is missing or wrong, an issue or a Discord note is the fastest way to reach the team.