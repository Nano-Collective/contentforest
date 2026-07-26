---
product: nanocoder
version: "1.29.0"
channel: reddit
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 9535
---

We just shipped a feature in Nanocoder v1.29.0 that is one keystroke: press `Ctrl+S` while a subagent is running and you jump into its live transcript. Press it again to cycle through parallel subagents. Press `Esc` to detach. The user-facing loop is small, but the under-the-hood story is worth writing up because almost none of it was obvious at the start.

## What the feature actually does

The top-level `App` component holds a single piece of state: `attachedAgentId`, a string or `null`. When it's `null`, the parent renders the normal interactive view. When it's a subagent's id, the parent renders `<SubagentView agentId={...}>` instead, which reads the subagent's session out of the session store and renders its messages, streaming text, and streaming reasoning, with a header `Main Session > <subagent name>` and a footer `Press Esc to detach`. That's the whole UI. The rest of the work is in the four edge cases that bit us.

## How parallel subagents are tracked

Subagents used to be modelled as a single in-progress notebook that the executor scribbled into. The attach feature needs the system to know about multiple subagents at once, so the executor and the events layer were reworked around a `Map<agentId, SubagentEvent>` in `source/services/subagent-events.ts`. Each entry holds the subagent's name, status, current tool, tool call count, turn count, token count, and a chronological `toolHistory` array. The executor calls `updateSubagentProgressById` and `appendSubagentTool` to keep the entry fresh.

The point of the `Map` is that the cycle key in `Ctrl+S` is just an index into the running entries. There is no separate "running subagents" list to keep in sync; the entries in the map are the running subagents. A subagent that completes is removed from the map by its executor, so it falls out of the cycle automatically. If the currently-attached agent has finished by the time you press `Ctrl+S` again, `currentIndex` is `-1` and we fall back to `runningAgents[0]`. That avoids the trap where the cycle is empty from the user's point of view but the JavaScript modulo would still try to target a finished agent.

## The bug: `<Static>` is append-only

The transcript in Nanocoder's terminal UI renders through Ink's `<Static>` component. `<Static>` is the Ink primitive that gives you a terminal scrollback: it renders each item once and leaves it on screen, so the chat history above the input box behaves like a real terminal pager. The catch is that `<Static>` tracks items by their position in the items array and only ever appends past that index. If you swap the items array out for a different transcript, the new items simply do not print, because `<Static>` thinks everything past its last index is empty.

The first version of `SubagentView` did exactly that. It rendered the subagent's messages into a `<Static>` and reused the same component across cycles. The first attach worked, because the items array was populated from scratch. Cycling to a second subagent meant putting a different items array into the same `<Static>`, and `<Static>` happily rendered nothing. From the user's point of view, `Ctrl+S` cycled the header text but the transcript never changed.

The fix is to give each agent's `<Static>` a different `key`, so React unmounts the old one and mounts a new one when the agent id changes. The line is in `SubagentView`: `clearKey={agentId}`. `ChatQueue` forwards `clearKey` to the `<Static key={clearKey} items={...}>`. When `agentId` changes, React remounts the `<Static>`, the new one starts with an empty item index, and it prints the new agent's transcript from scratch. The same `clearKey` trick is what `/clear` uses to wipe the parent transcript, by the way: the parent maintains a `conversationId` UUID and bumps it on `/clear`, and `InteractiveApp` passes that id down as `clearKey` to its own `ChatQueue`. The two paths share the same mechanism.

## The second bug: terminal garbage on switch

Remounting the `<Static>` solved the "new transcript never prints" problem, but it created a new one. Without an explicit screen wipe, the old agent's transcript stays on the terminal because Ink does not erase what `<Static>` already wrote. The new `<Static>` then paints over the top of the old text, and the result is a buffer of overlapping output: the parent session's screen, with the old agent's messages still visible behind the new agent's messages.

The fix is a one-line terminal write immediately before the state change:

```ts
if (!altScreenActive && process.stdout.isTTY) {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}
appState.setAttachedAgentId(nextAgentId);
```

`\x1B[2J` clears the screen, `\x1B[3J` clears the scrollback buffer, and `\x1B[H` moves the cursor home. That's the same sequence the CLI's `/clear` path uses, so the screen ends up in the same blank state as a fresh chat. The `!altScreenActive` guard skips the wipe when the user is in `--alt-screen` mode, because in alt-screen the viewport owns the screen and Ink's layout will repaint the new content into the right place on the next render.

This is the part of the fix that turned out to be invisible to users but obvious in retrospect. There is no scrollback for the attached agent while it is in flight, which sounds like a downside until you remember that the agent is still running: you can press `Ctrl+S` to come back to the parent at any time, and the parent's full transcript is still in scrollback. The attached view is a live console, not a saved page.

## The third bug: rapid `Ctrl+S` presses lose toggles

`Ctrl+S` is implemented as a `useInput` handler in `App`. It reads `appState.attachedAgentId`, computes the next agent id, and calls `appState.setAttachedAgentId(nextAgentId)`. The problem is that React batches state updates and the next `useInput` call sees the previous render's `appState.attachedAgentId` until the new render commits. If you press `Ctrl+S` twice in quick succession, the second press reads the same value as the first and tries to cycle to the same agent, which is no-op'd by the change-detection guard. The keystrokes are swallowed.

The fix is a ref that mirrors the state and updates synchronously inside the handler:

```ts
const attachedAgentIdRef = React.useRef(appState.attachedAgentId);
React.useEffect(() => {
  attachedAgentIdRef.current = appState.attachedAgentId;
}, [appState.attachedAgentId]);

const changeAttachedAgent = (nextAgentId: string | null) => {
  if (attachedAgentIdRef.current === nextAgentId) return;
  attachedAgentIdRef.current = nextAgentId; // sync update before React commits
  if (!altScreenActive && process.stdout.isTTY) {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  }
  appState.setAttachedAgentId(nextAgentId);
};
```

The ref is mutated synchronously, so the next `Ctrl+S` reads the new value even if React has not committed yet. This is the same pattern we use for `reasoningExpanded` and `compactToolDisplay`: state for rendering, ref for the synchronous handler.

## The detach UX

Detach is `Esc` from inside `SubagentView`. The handler calls `onDetach`, which is wired to `changeAttachedAgent(null)`. That re-enters the same screen-wipe path as a cycle, so the parent session renders into a clean terminal on the next paint.

There is one auto-detach path worth mentioning. If the attached agent's session is removed from the session store while you are attached to it (the executor cleans up on completion or error), the next render of `SubagentView` finds `session === undefined` and triggers a detach via a `useEffect`. This is the right behaviour: a subagent that finishes mid-attach should not leave you staring at a frozen screen. The detach is silent, because the parent's own transcript already shows the agent's completion event through the normal message stream.

The view itself polls the session store at 100ms with a `useReducer((x) => x + 1, 0)`-based forceRender, because the session store is a mutable `Map` and the executor mutates it in place.

## Why not a tabbed subagent console?

We considered a richer UI: a tabbed bar across the top with one tab per running subagent, clickable to switch, and a live status badge per tab. The lean `Ctrl+S` cycle came out ahead for two reasons. First, the terminal UI is not the only place subagents run; the VS Code sidebar shows them as live cards with their own progress, and the ACP path shows them through the editor's `plan` updates. Adding a tabbed UI to the terminal UI would be a third representation. Second, `Ctrl+S` cycle is the same muscle memory as `git rebase --interactive` and vim's buffer-switching, and it costs nothing to teach. The people who want a richer view are already in the VS Code GUI.

## Closing

The subagent inspector is a small feature in terms of lines of code, but it sits on top of three assumptions that did not hold at the start: `<Static>` is append-only, terminal scrollback persists across React remounts, and React state updates are not synchronous in synchronous handlers. The fixes are not clever; they are the right tool for each problem (a `key` for remount, a terminal wipe for the screen, a ref for the synchronous read). The pattern that emerged, ref-as-synchronous-mirror-of-state, is one we will keep using for any future keystroke.

If you find a `Ctrl+S` case that does not behave, please open an issue.

Repo, changelog, and docs are at https://github.com/Nano-Collective/nanocoder. Built by the Nano Collective, a community collective building AI tooling not for profit, but for the community.
