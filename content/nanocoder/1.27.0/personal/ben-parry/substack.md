---
kind: personal
member: ben-parry
channel: substack
product: nanocoder
version: "1.27.0"
generated_at: "2026-06-02T15:30:53.389Z"
model: "minimax-m2.7"
char_count: 11012
wont_use_at: "2026-06-10T09:29:15.728Z"
---

<!-- angle: The architecture of responsiveness - event-based systems vs command-based systems, and why the shift matters more than any individual feature. The daemon is the proof of concept; the principle generalises to AI tooling, hospitals, law firms, and any system where timing affects outcomes. -->

Most software waits. You invoke it, it does something, you get a result. That is the default. It is clean, intuitive, and works fine as long as the work you are doing maps onto a discrete action.

It stops working fine when the work is continuous.

A developer saves a file, reviews a diff, waits for a build, merges a branch. Each of these moments is a decision point. If the tool only runs when invoked, those moments pass without the context that would have made the tool useful. The invocation happens later, and the context it needed has evaporated.

The alternative most tools reach for is a scheduler. Run every N minutes. Check whether anything happened. This covers more ground, but it runs blind. The scheduler has no model of what changed, only that a clock ticked. The system fires when it is convenient for itself, not when something happened that warrants a response.

Neither pattern is wrong. Neither is enough.

## Summary

The shift from command-based to event-based architecture is one of the more consequential changes happening in software right now, even though it rarely shows up in release notes as a named thing. Most AI tools are still command-based: you invoke them, they do something. The more interesting question is what happens when you design the system around the event instead.

Nanocoder's v1.27.0 ships a background daemon that responds to file changes, cron schedules, and custom events defined in skill frontmatter. When the right signal fires, a Nanocoder session runs headlessly and does the thing it was built to do. The daemon is not the interesting part. The interesting part is what the architecture underneath it enables.

Event-triggered runs, built on a composable extension surface (Skills), with a parameterised tool layer that the model can invoke safely (Custom Tools), give you a system that responds to what happens in the codebase rather than waiting to be called. The answer is not a background process. The answer is a background process built on top of a composable architecture. The two are not the same.

## Executive Summary

- Most software runs on command. Event-based systems respond to what happens. The distinction matters more than any individual feature.
- A webhook that fires on every push knows exactly what changed. A scheduled job running every five minutes does not. The semantic richness of the event determines the quality of the response.
- Event-based systems reduce the dependency on human timing. If someone has to remember to invoke something, at some point they will not. A system that responds to events does not have this failure mode.
- The daemon is the proof of concept. What makes it worth having is the Skills architecture beneath it, and what makes Skills worth having is that the right signal can reach the right behaviour without manual intervention.
- The principle generalises beyond software. Hospitals, law firms, financial systems, regulatory bodies (anywhere where timing affects outcomes), the same structural logic applies.

## Key Points

- On-demand invocation is a hammer. It works well for discrete actions. It breaks down when the work is continuous.
- The scheduler alternative runs blind. It fires when the clock ticks, not when something happened that warranted a response.
- The architectural shift: from tools you invoke to systems that respond.
- Event-based systems require semantic richness in the signal. A file change without context is just noise.
- The daemon succeeds when the event is well-understood and the behaviour is well-defined. That requires an architecture that packages both the signal and the response together.
- Skills provide that packaging: versioned, self-describing units where the subscription event and the behaviour it triggers live in the same bundle.
- The principle applies beyond software: hospitals that alert on anomalies, law firms that respond to client communications as they arrive, financial systems that flag patterns as they emerge.
- Event-based systems change the role of human judgment. The human becomes the exception handler, not the initiator.
- The system operates continuously at low cost. Human attention is reserved for genuine problems, not routine execution.
- The daemon removes the ask. Someone no longer has to remember to run the thing.
- Command-based AI is a good hammer. Event-based AI is a different kind of tool - one that changes what the human is for.
- The shift is structural, not cosmetic. It changes the ownership model of the work.

---

Here is what I find interesting about the daemon release in Nanocoder v1.27.0: it is not the feature that matters. It is the architecture the feature sits on.

Most software waits. You invoke it, it does something, you get a result. That is the default. It is clean, intuitive, and works fine as long as the work you are doing maps onto a discrete action.

It stops working fine when the work is continuous.

A developer saves a file, reviews a diff, waits for a build, merges a branch. Each of these moments is a decision point. If the tool only runs when invoked, those moments pass without the context that would have made the tool useful. The invocation happens later, and the context it needed has evaporated.

The alternative most tools reach for is a scheduler. Run every N minutes. Check whether anything happened. This covers more ground, but it runs blind. The scheduler has no model of what changed, only that a clock ticked. The system fires when it is convenient for itself, not when something happened that warrants a response.

Neither pattern is wrong. Neither is enough.

## The architecture of responsiveness

The question is not how fast you can run. The question is what you run in response to.

A webhook that fires on every push knows exactly what changed. A scheduled job running every five minutes does not. The difference is not speed. It is whether the system has a model of the world it is operating in, or whether it is flying blind and hoping the schedule is close enough.

The first is intent. The second is configuration.

Intent matters because the quality of the response depends on the quality of the signal. A file change without context is just noise. Was this a temporary debug edit? A new feature? A refactor? The daemon that receives the event needs to know what it is receiving, and that knowledge has to live in the architecture, not in a human remembering to check.

This is where Skills become the load-bearing part. A skill is a versioned, self-describing bundle that packages a behaviour together with the context it needs. When a skill subscribes to a file change event, the signal arrives at a unit that knows what it is, what it needs, and how to respond. The architecture carries the meaning. The human does not have to.

What this changes is the ownership model of the work.

If someone has to remember to invoke the tool, at some point they will not. The afternoon meeting runs long. The context switches. The tool does not run, and the thing that was supposed to happen does not happen. This is not a failure of will. It is a structural problem with command-based systems: they require a human to maintain a timing relationship with the work.

Event-based systems do not have this failure mode. The system responds to what happens. The dependency on human timing is removed. Someone no longer has to remember to run the thing.

## What the principle looks like outside software

I find it useful to hold the principle up against fields that are not software, because the structural logic is the same everywhere.

A hospital that monitors patients continuously and alerts on anomalies is operating on events. A hospital that relies on a doctor to remember to check every patient's status at the right interval is operating on a schedule. The first system does not require a doctor to hold the timing of every patient's condition in their head at all times. The second one does.

A law firm that responds to client communications as they arrive, routes them to the right person, opens the relevant matter, and flags deadline risks, is an event-based system. A firm that reviews everything in a weekly batch meeting has the same information but arrives at it later, with less context, and with the same structural dependency on someone remembering to do the review.

A financial system that flags patterns as they emerge is event-based. A system that produces a weekly report that someone has to read and act on is schedule-based. The first changes when the human gets involved. The second changes whether the human has the time and context to act.

In each case, the event-based version requires more architecture up front. You need richer signals. You need the behaviour to live close to the signal. You need the system to carry the meaning, not rely on the human to hold it.

The payoff is that the system can operate continuously at low cost, and human attention is reserved for the cases that actually need it.

## The daemon as proof of concept

Nanocoder's v1.27.0 ships a background daemon that subscribes to file changes, cron schedules, and custom events. When the right signal fires, a Nanocoder session runs headlessly. No prompts, no foreground confirmations, no interactive TUI. The session starts, does the thing it was built to do, and finishes.

The daemon is not the interesting part. Long-running processes exist everywhere. What makes this architecture worth building is what sits underneath it.

Skills package commands, tools, and subagents into versioned, composable bundles with shared context. A skill that subscribes to a file change event is a self-describing unit: it knows what it is, what it needs, and what to do when the signal arrives. The signal does not land in a void. It lands in a rich, structured behaviour that was designed to receive it.

Custom Tools sit in the middle of the extension surface. They are not prompt injection (which requires the model to route the instruction through its own reasoning). They are not a full MCP server (which requires a running external process and a defined transport). They are a shell command defined in markdown, with YAML parameter declarations and template substitution that is shell-quoted to prevent injection. The model sees the schema. It decides when to call it. The substitution layer handles the quoting so the command does what the parameter values say, not what an adversarial input tries to make them do.

The three layers compose. The event arrives at a skill that knows how to handle it. The skill can invoke custom tools with parameter safety. The whole system runs headlessly, without requiring a human in the loop.

The daemon would be a useful standalone feature. What makes it worth having is that this composition is possible.

## The structural claim

Here is the thing I keep returning to: the shift from command-based to event-based architecture changes what the human is for.

In a command-based system, the human initiates. They decide when to run the tool, what to ask for, what to do with the output. The tool is an instrument they operate.

In an event-based system, the system watches. It responds to what happens. The human handles exceptions: the edge cases, the ambiguous signals, the situations where the automated response is wrong or insufficient.

This is a different relationship with the work. The human is no longer the initiator of routine tasks. They are the owner of the cases that break the routine.

Most AI tooling is still command-based. You invoke it, it does something. That is useful. But it does not change the human's role in the loop. The human is still the initiator.

The more interesting question (the one that keeps me building) is what happens when you design the system so the right signal can reach the right behaviour without the human having to be there for it.

The daemon is a proof of concept. The principle is larger than the implementation.

## What this means for how we build

When I think about the architecture we are working toward, it is something like this: the system operates continuously at low cost, and human attention is the scarce resource reserved for genuine problems. Not routine execution. Not the stuff that someone had to remember to set up. The actual hard cases.

This requires more upfront investment in the architecture. Richer signals. Better packaging of behaviour. A system that can carry meaning without relying on a human to hold it.

It is worth it.

The alternative (command-based systems that require human timing to maintain) has a ceiling on how much it can take off a person's plate. You can automate individual tasks. You cannot change the human's relationship with the work unless the system can operate without being asked.

The daemon in v1.27.0 is one instance of this. The architecture underneath it is the more important part.

The answer is not a background process. The answer is a background process built on top of a composable architecture, so that the right signal can trigger the right behaviour without manual invocation.

That is what we are building toward. Not just in Nanocoder. In the thinking about what AI tooling should be.