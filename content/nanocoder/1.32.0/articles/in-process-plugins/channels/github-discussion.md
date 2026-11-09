---
product: nanocoder
version: "1.32.0"
channel: github-discussion
title: "Nanocoder plugins: JavaScript that can veto a tool call from inside the agent"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 11972
---

Nanocoder v1.32.0 shipped in-process plugins. If you have been using lifecycle hooks, you already know the problem they solve: you want a rule to hold in every session, every project, without remembering to run a script by hand. Hooks got you most of the way. Plugins close the remaining gap, because a hook is a shell command and a plugin is code running inside the agent.

This is a walk through what the extension point actually is, what each of the five hooks can do, and where the boundaries are.

```bash
npm install -g @nanocollective/nanocoder
```

Repo, issues and the full changelog: https://github.com/Nano-Collective/nanocoder

## The extension point

A plugin is a JavaScript module loaded from `.nanocoder/plugins/` at the project root. One `.mjs` file per plugin. The extension is `.mjs` so Node loads it as ESM even when your project is CommonJS. Files load in filename order.

The default export is the plugin object. There is nothing to import at runtime, so a plugin has no dependency on Nanocoder's internals and no version coupling beyond the API number it declares:

```js
export default {
	apiVersion: 1,
	name: 'guard',
	hooks: {
		'tool.execute.before': ({toolName, toolArgs}) => {
			if (toolName === 'execute_bash' && String(toolArgs.command).includes('rm -rf')) {
				return {block: 'rm -rf is not allowed in this repo'};
			}
		},
	},
};
```

For editor type checking, point a JSDoc `@type` at the published types, which ship with the CLI:

```js
/** @type {import('@nanocollective/nanocoder/dist/sdk/plugin.js').NanocoderPlugin} */
export default { /* ... */ };
```

The plugin's `name` has to be unique across the loaded set. A second file declaring a name that is already loaded is skipped, and the first one wins. Files are loaded alphabetically, so `1-guard.mjs` sorts before `2-audit.mjs` if you want a deterministic order.

## The five hooks

There are five, and each maps onto a lifecycle point the hook system already has.

| Plugin hook | Lifecycle event | What it can do |
| --- | --- | --- |
| `tool.execute.before` | `pre-tool-use` | Refuse a tool call |
| `tool.execute.after` | `post-tool-use` | Add text to the tool result |
| `session.compacting` | `pre-compact` | Observe, nothing else |
| `tui.prompt.append` | `user-prompt-submit` | Add context to the prompt |
| `permission.asked` | (approval only) | Deny a permission prompt outright |

Each hook may return its result directly or as a promise.

### `tool.execute.before` refuses the call

Return `{block: 'reason'}` and the tool does not run. The reason is what the model and the user both see, so write it for a human:

```js
'tool.execute.before': ({toolName, toolArgs}) => {
	if (toolName === 'execute_bash' && String(toolArgs.command).includes('rm -rf')) {
		return {block: 'rm -rf is not allowed in this repo'};
	}
},
```

The context is `{toolName, toolArgs}`. `toolArgs` is a structured clone, so a plugin cannot mutate the arguments the tool is about to receive by holding on to the object.

The gate runs ahead of the approval prompt, at more than one layer. The interactive TUI gates before it renders a confirmation, and the execution boundary gates again, so a tool that is about to be refused never asks you to approve it. The gate runs once per tool call, however many layers ask, because hooks have side effects: an audit-log plugin wants one line per call, not one per layer that happens to check.

### `tool.execute.after` annotates the result

Return `{append: 'text'}` and the text is folded into the tool result the model reads, inside the same `<hook-output>` block a shell hook uses:

```js
'tool.execute.after': ({toolName, toolResult}) => ({
	append: `${toolName} returned ${toolResult.length} chars. Remember to run the tests.`,
}),
```

This is the difference from a shell hook that matters most in practice. A shell hook's stdout becomes the same kind of block, so on the surface the two look similar. What differs is the input. A plugin receives the tool result as a string in the same process, so it can read it, measure it, parse it, or decide whether to say anything at all. A shell hook has to receive it through an environment variable and parse it back.

The context is `{toolName, toolArgs, toolResult}`.

### `session.compacting` observes

It fires when the session is about to compact, both automatically and via `/compact`. The context is `{messageCount}`.

It is observe-only, and that is deliberate. Compaction cannot be vetoed, because refusing it would leave the context over the model's limit, which is the problem compaction exists to solve. A shell `pre-compact` hook is the same: observe-only for the same reason. Use this one to archive the conversation somewhere before it is summarised away.

### `tui.prompt.append` adds context to your prompt

Return a string and it is prepended to the prompt context, the same way `session-start` and `user-prompt-submit` hook output is buffered:

```js
'tui.prompt.append': ({prompt}) => {
	if (prompt.includes('release')) return 'release branch: main, tag v1.32.0';
},
```

It cannot block the prompt. A shell hook on `user-prompt-submit` can, by exiting non-zero. The plugin hook cannot, by design.

The context is `{prompt}`.

### `permission.asked` denies without asking

This is the one that has no shell-hook equivalent. It fires when a tool is about to prompt you for approval. Return `{decision: 'deny', reason: '...'}` and the tool is refused without the prompt ever being rendered. Return `{decision: 'defer'}` and you get the normal prompt.

```js
'permission.asked': ({toolName, toolArgs}) =>
	toolName === 'execute_bash' && String(toolArgs.command).includes('--force')
		? {decision: 'deny', reason: 'no force push'}
		: {decision: 'defer'},
```

A plugin cannot approve a tool. There is no `allow` decision. If a plugin returns one, it is logged as an invalid vote and treated as a defer, so the prompt still appears and you still decide. The plugin surface is a brake, not a throttle.

The context is `{toolName, toolArgs}`.

## How this differs from a shell hook

Worth stating plainly, because the two systems sit next to each other and the difference is not just syntax.

**A shell hook communicates through exit codes and stdout.** A non-zero exit vetoes on `pre-tool-use` and `user-prompt-submit`. Everything the hook knows about the moment arrives as `NANOCODER_*` environment variables.

**A plugin communicates through return values.** It gets structured arguments, it decides what to do with them in ordinary JavaScript, and it returns a typed result.

The consequences:

- **A plugin can deny a permission prompt without asking.** A shell hook cannot. The closest a shell hook gets is exiting non-zero at `pre-tool-use`, which refuses the call but does not participate in the approval flow.
- **A plugin can annotate a result conditionally.** It can look at the result first and stay quiet if there is nothing worth saying. A shell hook that prints anything, prints it.
- **A plugin gets the arguments as data, not as text.** `toolArgs` is an object, so `toolArgs.path` is a path rather than a string you would parse out of an environment variable. It is cloned, so mutating it does not change what the tool receives.
- **A plugin can read the result.** The `tool.execute.after` context carries `toolResult` as a string, so a plugin can compute over it rather than just react to it.

What plugins do not add: they cannot register new tools, they cannot change how a tool behaves beyond the five hooks, and they cannot approve anything.

## The safety contract

An extension point that runs arbitrary code inside the agent could easily be a footgun. The rules below are the reason it is not.

**It only loads in a trusted directory.** Plugins load only after you have trusted the project folder, the same trust gate that covers hooks, formatters, MCP servers and custom tools. The trust prompt lists the plugin files by name with a hash of each one, and trust is tied to a fingerprint of the whole set. Change a plugin file and the prompt comes back the next time Nanocoder starts there. `nanocoder trust --status` shows the same list and fingerprint without running anything.

A plugin runs with the same privileges as Nanocoder itself, and it inherits the whole environment, including provider API keys. This is not a sandbox. It is the same trust you already extend to an `mcpServers` entry in `agents.config.json`, so treat a repository's `.nanocoder/plugins/` the way you would treat its `package.json` scripts.

**A plugin that throws is logged and ignored.** The error is caught, logged with the plugin's name and the hook that failed, and the hook returns as if it produced nothing. The agent carries on. A plugin that returns the wrong shape is treated the same way: the malformed return is logged and skipped, it never blocks anything.

**A plugin that hangs is skipped after 30 seconds.** The same ceiling applies to loading and to each hook invocation. A file whose import never finishes is skipped, and the files after it still load, so one bad plugin cannot take the others down with it. The chat prompt waits for the plugin load to finish, which is why the timeout is not something you want to hit routinely.

**A plugin cannot approve a tool and cannot add one.** The vote is binary in effect: deny or defer. There is no way to grant approval, and the plugin API has no tool-registration surface. If you want a new tool, that is a different extension point (`.nanocoder/tools/`, and the MCP servers in `agents.config.json`).

**Shell hooks run first.** For the same event, the shell hooks fire before the plugins. If a shell hook blocks, the plugins do not run at all. The first veto ends the chain.

**Editor sessions are isolated.** An ACP session has no trust prompt, so it loads plugins from the session's workspace only when that directory is already in your trusted list. Plugins are scoped per workspace, including when sessions run concurrently, so one editor workspace's plugin cannot gate another workspace's tools. Daemon-triggered runs load the project's plugins too, after the daemon's own trust check.

## Writing one

Here is a complete plugin that does three things: blocks `rm -rf`, refuses force pushes, and annotates writes with a reminder to run the tests.

```js
export default {
	apiVersion: 1,
	name: 'repo-policy',
	hooks: {
		'tool.execute.before': ({toolName, toolArgs}) => {
			if (toolName !== 'execute_bash') return;
			const command = String(toolArgs.command ?? '');
			if (command.includes('rm -rf')) {
				return {block: 'rm -rf is not allowed in this repo'};
			}
		},
		'permission.asked': ({toolName, toolArgs}) =>
			toolName === 'execute_bash' && String(toolArgs.command).includes('--force')
				? {decision: 'deny', reason: 'no force push'}
				: {decision: 'defer'},
		'tool.execute.after': ({toolName}) =>
			toolName === 'write_file'
				? {append: 'File written. Run the test suite before you claim it works.'}
				: undefined,
	},
};
```

Save it as `.nanocoder/plugins/repo-policy.mjs`, trust the directory when the prompt appears, and it is live for the session.

## What this is not

This is the initial in-process plugin API. Its types ship with the CLI. A separately published, independently versioned SDK package, and custom UI component APIs, are not provided yet. There is no plugin marketplace, no hot reload, and no way for a plugin to contribute a new panel to the interface.

If you were holding a rule in a shell script and retyping it into every session, or if you wanted a policy that could refuse an approval prompt rather than just failing a call, this is the piece that was missing.

The docs for this live with the lifecycle hooks, since the two share the same events and the same trust gate: https://github.com/Nano-Collective/nanocoder

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.
