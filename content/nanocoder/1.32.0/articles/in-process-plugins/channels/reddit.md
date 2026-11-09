---
product: nanocoder
version: "1.32.0"
channel: reddit
title: "Nanocoder plugins: JavaScript that can veto a tool call from inside the agent"
generated_at: "2026-11-04T16:52:24.846Z"
model: "minimax-m3"
char_count: 4877
---

We shipped a small extension point in Nanocoder v1.32.0 that we have been wanting for a while: in-process plugins. A plugin is a `.mjs` file you drop in `.nanocoder/plugins/` at the project root, and it runs inside the agent rather than beside it as a shell command.

**Why bother, when lifecycle hooks already exist?**

Hooks are shell commands. They talk in exit codes and `NANOCODER_*` environment variables. A non-zero exit on `pre-tool-use` vetoes the call, and stdout on `post-tool-use` gets folded into the tool result. That is genuinely useful and it stays the right tool for most rules.

The gap was that a hook cannot participate in the approval flow, and it cannot look at the arguments as structured data. A plugin can.

**There are five hooks:**

- `tool.execute.before` returns `{block: 'reason'}` and the tool does not run. The reason is shown to you and to the model.
- `tool.execute.after` returns `{append: 'text'}` and the text lands in the tool result the model reads, inside the same `<hook-output>` block a shell hook uses.
- `session.compacting` fires before compaction and is observe-only. Compaction cannot be vetoed, because refusing it would leave the context over the model's limit, which is the problem it exists to solve.
- `tui.prompt.append` returns a string that gets prepended to your prompt context. It cannot block the prompt.
- `permission.asked` fires when a tool is about to ask you for approval. Return `{decision: 'deny', reason: '...'}` and the tool is refused without the prompt being rendered at all.

That last one is the bit with no shell-hook equivalent. A plugin can refuse a tool that was on its way to prompting you.

**What a plugin cannot do, which matters as much as what it can:**

It cannot approve a tool. There is no `allow` decision. If a plugin returns one, it gets logged as an invalid vote and treated as `defer`, so you still get the prompt and you still decide. It also cannot register a new tool. The plugin surface is a brake, not a throttle.

**The safety contract.** This is the part we spent the most time on, because an extension point that runs arbitrary code inside the agent is a footgun waiting to happen:

- Plugins load only in a directory you have trusted. The trust prompt lists the plugin files by name with a hash of each, and trust is fingerprinted over the whole set, so editing a plugin brings the prompt back. `nanocoder trust --status` shows the same thing without running anything.
- A plugin that throws is caught, logged with its name and the hook that failed, and ignored. It never blocks the agent.
- A plugin that returns the wrong shape is logged and skipped, the same way.
- A plugin that hangs is skipped after 30 seconds. That ceiling applies to loading and to each hook call. A file whose import never finishes is skipped, and the files after it still load, so one bad plugin cannot take the others down with it.
- A plugin runs with the same privileges as Nanocoder itself and inherits the whole environment, including provider API keys. It is not sandboxed. It is the same trust you already extend to an `mcpServers` entry in `agents.config.json`, so we think of it the same way: treat a repo's `.nanocoder/plugins/` the way you would treat its `package.json` scripts.

A couple of smaller things: shell hooks run before plugins for the same event, and if a shell hook blocks, the plugins never run. Editor (ACP) sessions have no trust prompt, so they load plugins from the session's workspace only if that directory is already in your trusted list, and plugins are isolated per workspace even when sessions run concurrently. Daemon-triggered runs load them too, after the daemon's trust check.

Here is a whole plugin:

```js
export default {
	apiVersion: 1,
	name: 'repo-policy',
	hooks: {
		'tool.execute.before': ({toolName, toolArgs}) => {
			if (toolName !== 'execute_bash') return;
			if (String(toolArgs.command ?? '').includes('rm -rf')) {
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

Two honest caveats. The plugin's `name` has to be unique, and the first file to claim it wins. And this is the initial API: the types ship with the CLI, but there is no separately published, independently versioned SDK package yet, no marketplace, no hot reload, and no way for a plugin to contribute a UI component.

The docs live with the lifecycle hooks, since the two share the same events and the same trust gate. Repo and changelog: https://github.com/Nano-Collective/nanocoder
