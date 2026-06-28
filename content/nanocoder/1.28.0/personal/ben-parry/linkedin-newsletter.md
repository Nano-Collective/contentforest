---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T20:19:16.083Z"
model: "minimax-m3"
char_count: 5739
---

# Mind & Machine, Issue 21: The placement problem

I want to talk about three changes we shipped in Nanocoder 1.28.0, but I don't want to lead with what shipped. I want to lead with why the placement of an AI agent inside your workflow decides almost everything else about how it behaves.

Most AI coding tools are stuck in a terminal panel. That placement looks innocuous. It isn't. The terminal has a fixed shape of interaction: a prompt, some coloured text, a permission yes/no. Once an agent lives there, every feature the team builds gets filtered through the affordances the terminal can offer. Streaming text becomes a sequence of redraws. Diffs become before/after blobs you have to scroll past. Permission prompts become line-noise interrupting your flow.

The richer the work, the more friction that filter creates. So teams either accept the friction, or they bolt on a web UI that lives somewhere else entirely, and the agent stops feeling like part of the editor at all.

## What we shipped and how it works

Three things, in order of how much they changed my day-to-day.

**First, Agent Client Protocol support.** Run `nanocoder --acp` and Nanocoder speaks JSON-RPC over stdin/stdout. The editor becomes the UI. Streaming text, tool cards, before/after diffs on `string_replace` and `write_file`, permission prompts, model switching, and `ask_user` options render in the editor instead of the Ink terminal UI. The four development modes (normal, auto-accept, yolo, plan) are exposed as session modes you flip from inside the editor. Sessions start in auto-accept.

The reference client is Zed. Registration is two lines in `settings.json`:

```json
{
  "agent_servers": {
    "Nanocoder": {
      "command": "nanocoder",
      "args": ["--acp"]
    }
  }
}
```

The new module lives at `source/acp/` and covers the agent, server, session, conversation loop, content conversion, capability negotiation, and permission handling. Credit to @Avtrkrb for the original implementation.

**Second, a tool-surface consolidation.** Built-in tool count went from 33 to 19. The cuts were deliberate: tasks collapsed to a single `write_tasks` that replaces the whole list (no IDs for the model to juggle). File ops merged delete, move, copy, and create_directory into one `file_op`. Git shrank from eleven tools to six. Roughly 6.3k lines went out with this work.

Alongside that, the new `auto` tune profile is now the default. It infers `full`, `minimal`, or `nano` from the active model's parameter count, re-resolves live on model switch, and surfaces the active profile in the input indicator. Small local models get the slim tool set and a shorter prompt automatically. No config change.

**Third, session resume with full history replay.** Resuming a saved session now replays the message and tool-call history into the chat view via a new session-history-renderer. You pick up where you left off with the conversation visible, instead of an empty screen that pretends nothing happened. An autosave race and a few resume edge cases were fixed at the same time.

## Why the architecture looks the way it does

None of these are feature moves. They're all consequences of three structural beliefs we've held for a while.

A tool surface should match the cognitive bandwidth of the thing using it. A 7B local model can't reliably juggle 33 tool definitions and the JSON arguments each one expects. The right answer isn't better prompting. It's fewer tools, cleaner schemas, and profile inference that picks the right set without a config file.

Placement is architecture. The decision to live in a terminal panel versus an editor versus a chat app is the design. Once you choose, every subsequent affordance is downstream. ACP moves the agent into the editor and inherits the editor's affordances for free: streaming, diffs, permission UI, selection. The team gets to stop reinventing a half-decent version of what the editor already does well.

History that survives a restart is a different kind of feature. It's an acknowledgement that work happens across days, not across single sessions. Replaying the conversation into the chat view, rather than handing the model a flattened summary, lets the agent (and the user) recover the texture of what was tried and why.

## The broader principle

Across all three changes, the same shape repeats: less surface area, better placement, history that survives a restart.

If you spend time around how AI tooling gets used inside companies, this shape shows up everywhere. The tools that feel good are the ones that removed something rather than added something. The tools that feel intrusive are the ones that bolted a feature onto a placement that was wrong from the start. The tools people trust are the ones that remember what happened yesterday without being asked.

The answer to most AI-tool questions isn't more features. It's better architecture. Always has been.

## What's next

Directional, not a promise. The ACP integration is currently in-memory across editor restarts. Persisting ACP session history to disk is the obvious next move. The skill linter shipped in this release is the seed for a broader linting story across skills, agents, and commands. The `auto` profile inference is going to keep refining as more model parameter counts land in the wild. And the per-tool JSON-schema validation at the execution boundary, which returned clear field-level errors the model can self-correct from, is the kind of plumbing that quietly compounds.

Nothing here is a roadmap. It's the direction the architecture is already pulling toward. We'll get there when we get there.

If this is the kind of work you want to follow, the rest of Mind & Machine lives at nanocollective.org.