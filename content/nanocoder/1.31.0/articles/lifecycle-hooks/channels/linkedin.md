---
product: nanocoder
version: "1.31.0"
channel: linkedin
generated_at: "2026-09-27T14:25:17.704Z"
model: "minimax-m3"
char_count: 1907
---

Nanocoder v1.31 promotes lifecycle hooks from a draft surface to a real configuration section. The shape of the feature is simple: there are six predictable points in the agent loop, and you can wire a shell command to any of them.

The six points: `session-start`, `session-end`, `user-prompt-submit`, `pre-tool-use`, `post-tool-use`, and `pre-compact`. A hook runs at that point in the loop, every time, without involving the model. No tokens, no daemon, no "the model remembered to call it". On two of the six points (`pre-tool-use` and `user-prompt-submit`) a non-zero exit can refuse to let the action happen, and the message goes back to the model so it can adapt instead of retry blindly.

The `pre-tool-use` gate sits ahead of the approval prompt in the interactive TUI and in subagents, so a denied tool never renders a confirmation prompt and never reaches the handler. You see the denial, not a diff preview you have to approve first. ACP is the one surface where the editor owns the permission request and issues it first, but the call is still blocked.

The piece v1.31 adds is `matchPaths`, the second of the two scoping fields. With `matchTools` it lets one formatter per language be declared directly: `matchTools: ["write_file", "string_replace"], matchPaths: ["**/*.{ts,tsx}"]`. Before this, the only way to scope a hook by file was to dispatch on the extension inside the command with a `case` statement, which does not cross from POSIX to Windows. `matchPaths` is the portable version of that pattern, and it is not just for formatting.

One thing operators miss: hooks are not merged. Like the rest of `agents.config.json`, the nearest `hooks` block replaces the one above it. A project that defines any hook at all disables every global hook, including a global `pre-tool-use` policy. `/doctor` prints what actually loaded.

Full docs at https://github.com/Nano-Collective/nanocoder.
