---
product: nanocoder
version: "1.29.0"
channel: github-discussion
title: "Attaching to a running subagent without losing the transcript"
generated_at: "2026-07-26T19:36:06.832Z"
model: "minimax-m3"
char_count: 13426
---

Nanocoder v1.29.0 ships a subagent inspector: press `Ctrl+S` while a subagent is running and you jump into its live transcript, including the reason it picked a particular tool and the text it is streaming in. Press `Ctrl+S` again to cycle across parallel subagents, or `Esc` to drop back to the parent session. Under the hood the feature is small, but two of the bugs we hit while building it are worth writing up because they are the kind of thing that only shows up when you actually try to use the thing in anger, and the fix in each case came from a place in Ink we had not looked at before.

This is the deep dive on the `Ctrl+S` attach path. The headline for the release is the native VS Code GUI; this post is for the readers who want to know how the terminal UI behaves when subagents are running in parallel.

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

The full project lives at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).

## The feature, in one paragraph

The top-level `App` component holds a single piece of state: `attachedAgentId`, a string or `null`. When it is `null`, the parent renders the normal interactive `<InteractiveApp>` view. When it is a subagent's id, the parent renders `<SubagentView agentId={...}>` instead, which reads the subagent's session out of the session store and renders its messages, streaming text, and streaming reasoning, with the header `Main Session > <subagent name>` and a footer `Press Esc to detach`. That's the whole UI. The rest of the work is in the four edge cases that bit us.

## Tracking parallel subagents: a `Map` keyed by agent id

Subagents have been around for a while, but they used to be modelled as a single in-progress notebook that the executor scribbled into. The attach feature needs the system to know about multiple subagents at once, so the executor and the events layer were reworked around a `Map<agentId, SubagentEvent>` in `source/services/subagent-events.ts`. Each entry holds the subagent's name, status, current tool, tool call count, turn count, token count, and a chronological `toolHistory` array. The executor calls `updateSubagentProgressById(agentId, ...)` and `appendSubagentTool(agentId, ...)` to keep the entry fresh, and the UI calls `getAllSubagentProgress()` to read them.

The point of the `Map` is that the cycle key in `Ctrl+S` is just an index into the running entries. There is no separate "running subagents" list to keep in sync; the entries in the map are the running subagents. A subagent that completes is removed from the map by its executor, so it falls out of the cycle automatically.

```ts
// excerpt: source/app/App.tsx
const progresses = Array.from(getAllSubagentProgress().entries());
const runningAgents = progresses
  .filter(([_, p]) => p.status !== 'complete' && p.status !== 'error')
  .map(([id]) => id);

const current = attachedAgentIdRef.current;
if (runningAgents.length === 0) {
  changeAttachedAgent(null);
} else if (!current) {
  changeAttachedAgent(runningAgents[0]);
} else {
  const currentIndex = runningAgents.indexOf(current);
  changeAttachedAgent(
    currentIndex === -1
      ? runningAgents[0]
      : runningAgents[(currentIndex + 1) % runningAgents.length],
  );
}
```

A subtle point: if the currently-attached agent has finished by the time you press `Ctrl+S` again, `currentIndex` is `-1` and we fall back to `runningAgents[0]`. That avoids the trap where the cycle is empty from the user's point of view but the JavaScript modulo would still try to target a finished agent.

## The bug: `<Static>` is append-only

The transcript in Nanocoder's terminal UI renders through Ink's `<Static>` component. `<Static>` is the Ink primitive that gives you a terminal scrollback: it renders each item once and leaves it on screen, so the chat history above the input box behaves like a real terminal pager. The catch is that `<Static>` tracks items by their position in the items array and only ever appends past that index. If you swap the items array out for a different transcript, the new items simply do not print, because `<Static>` thinks everything past its last index is empty.

The first version of `SubagentView` did exactly that. It rendered the subagent's messages into a `<Static>` and reused the same component across cycles. The first attach worked, because the items array was populated from scratch. Cycling to a second subagent meant putting a different items array into the same `<Static>`, and `<Static>` happily rendered nothing. From the user's point of view, `Ctrl+S` cycled the header text but the transcript never changed.

The fix is to give each agent's `<Static>` a different `key`, so React unmounts the old one and mounts a new one when the agent id changes. The line is in `SubagentView`:

```tsx
<ChatQueue
  staticComponents={[]}
  queuedComponents={chatComponents}
  // key the underlying <Static> by agent so cycling to another
  // session remounts it. A reused <Static> only ever appends
  // past its item index, so the new agent's transcript would
  // otherwise never print.
  clearKey={agentId}
  disableStatic={altScreenActive}
  renderLastQueuedComponentLive={false}
/>
```

`ChatQueue` forwards `clearKey` to the `<Static key={clearKey} items={...}>`. When `agentId` changes, React remounts the `<Static>`, the new one starts with an empty item index, and it prints the new agent's transcript from scratch. The same `clearKey` trick is what `/clear` uses to wipe the parent transcript, by the way: the parent maintains a `conversationId` UUID and bumps it on `/clear`, and `InteractiveApp` passes that id down as `clearKey` to its own `ChatQueue`. The two paths share the same mechanism.

## The second bug: terminal garbage on switch

Remounting the `<Static>` solved the "new transcript never prints" problem, but it created a new one. Without an explicit screen wipe, the old agent's transcript stays on the terminal because Ink does not erase what `<Static>` already wrote. The new `<Static>` then paints over the top of the old text, and the result is a buffer of overlapping output: the parent session's screen, with the old agent's messages still visible behind the new agent's messages.

The fix is a one-line terminal write immediately before the state change:

```ts
if (!altScreenActive && process.stdout.isTTY) {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}
appState.setAttachedAgentId(nextAgentId);
```

`\x1B[2J` clears the screen, `\x1B[3J` clears the scrollback buffer, and `\x1B[H` moves the cursor home. That is the same sequence the CLI's `/clear` path uses, so the screen ends up in the same blank state as a fresh chat. The `!altScreenActive` guard skips the wipe when the user is in `--alt-screen` mode, because in alt-screen the viewport owns the screen and Ink's layout will repaint the new content into the right place on the next render.

This is the part of the fix that turned out to be invisible to users but obvious in retrospect. There is no scrollback for the attached agent while it is in flight, which sounds like a downside until you remember that the agent is still running: you can press `Ctrl+S` to come back to the parent at any time, and the parent's full transcript is still in scrollback. The attached view is a live console, not a saved page.

## The third bug: rapid `Ctrl+S` presses lose toggles

`Ctrl+S` is implemented as a `useInput` handler in `App`. When you press it, the handler reads `appState.attachedAgentId`, computes the next agent id, and calls `appState.setAttachedAgentId(nextAgentId)`. The problem is that React batches state updates and the next `useInput` call sees the previous render's `appState.attachedAgentId` until the new render commits. If you press `Ctrl+S` twice in quick succession, the second press reads the same `appState.attachedAgentId` as the first and tries to cycle to the same agent, which is no-op'd by the `if (attachedAgentIdRef.current === nextAgentId) return;` guard. The keystrokes are swallowed.

The fix is a ref that mirrors the state and updates synchronously inside the handler:

```ts
// mirror of attachedAgentId that updates synchronously, so rapid Ctrl+S
// presses cycle correctly even before React commits the previous change.
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

The ref is mutated synchronously inside the handler, so the next `Ctrl+S` reads the new value even if React has not committed yet. The `useEffect` keeps the ref in sync with `appState` for the rest of the app, in case `setAttachedAgentId` is called from a non-handler path (it is not, but the invariant is cheap).

This is the same pattern we use for `reasoningExpanded`, `compactToolDisplay`, and the `compactToolCountsRef` accumulator: state for rendering, ref for the async conversation loop. The pattern is set up in `useAppState.tsx`. The trick is that state reads inside synchronous handlers need a ref, while state reads inside async loops are fine with the state value because the loop will re-render on the next batch anyway.

## The detach UX

Detach is `Esc` from inside `SubagentView`. The handler calls `onDetach`, which is wired to `changeAttachedAgent(null)`. That re-enters the same screen-wipe path as a cycle, so the parent session renders into a clean terminal on the next paint.

There is one auto-detach path worth mentioning. If the attached agent's session is removed from the session store while you are attached to it (the executor cleans up on completion or error), the next render of `SubagentView` finds `session === undefined` and triggers a detach via a `useEffect`:

```ts
useEffect(() => {
  if (!session) {
    onDetach();
  }
}, [session, onDetach]);
```

This is the right behaviour: a subagent that finishes mid-attach should not leave you staring at a frozen screen. The detach is silent (no "agent finished" toast), because the parent's own transcript already shows the agent's completion event through the normal message stream.

The view itself polls the session store at 100ms with a `useReducer((x) => x + 1, 0)`-based forceRender, because the session store is a mutable `Map` and the executor mutates it in place. A subscription-based store would be cleaner, but the polling approach is robust to out-of-band writes from the executor's promise chain and does not require sharing the store's internal mechanics.

## What the user sees

A typical session looks like this. You type a prompt that the main agent decides to delegate: "read the changelog and tell me what changed in the CLI flags in 1.29.0." The main agent invokes the `agent` tool with a subagent type. The subagent starts running.

You press `Ctrl+S`. The screen wipes.

```
Main Session > changelog-explorer
... (subagent's streamed text, its full tool history, its reasoning)
```

You press `Ctrl+S` again. If another subagent is running, the screen wipes and the next agent's transcript renders. If not, the parent session renders back. You press `Esc` from inside an attached view to detach immediately.

If a subagent finishes while you are attached, you stay in the view until the next render (typically within 100ms), then auto-detach into the parent. The parent's transcript shows the agent's completion event normally.

## Why not a real "tabbed" subagent console?

We considered a richer UI: a tabbed bar across the top with one tab per running subagent, clickable to switch, and a live status badge per tab. The lean `Ctrl+S` cycle came out ahead for two reasons. First, the terminal UI is not the only place subagents run; the VS Code sidebar shows them as live cards with their own progress, and the ACP path shows them through the editor's `plan` updates. Adding a tabbed UI to the terminal UI would be a third representation, which is one too many. Second, `Ctrl+S` cycle is the same muscle memory as `git rebase --interactive` and vim's buffer-switching, and it costs nothing to teach. The people who want a richer view are already in the VS Code GUI.

## Closing notes

The subagent inspector is a small feature in terms of lines of code, but it sits on top of three assumptions that did not hold at the start: `<Static>` is append-only, terminal scrollback persists across React remounts, and React state updates are not synchronous in synchronous handlers. The fixes are not clever; they are the right tool for each problem (a `key` for remount, a terminal wipe for the screen, a ref for the synchronous read). The pattern that emerged, ref-as-synchronous-mirror-of-state, is one we will keep using for any future keystroke that needs to debounce against rapid presses.

If you find a `Ctrl+S` case that does not behave, please open an issue. The fix is small but the test surface is exactly the kind of thing that benefits from a real reproduction.

Repo, changelog, and docs are at [https://github.com/Nano-Collective/nanocoder](https://github.com/Nano-Collective/nanocoder).
