---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:28:32.462Z"
model: "minimax-m3"
char_count: 4394
distributed_at: "2026-05-12T13:44:23.120Z"
---

Most AI tooling assumes abundance. Abundant context windows, abundant compute, abundant memory. Build for the largest deployment and ship a slightly throttled version for smaller setups.

That assumption has a cost. When you run a 1B or 3B model on a machine with limited VRAM, every token in your system prompt is a token that can't be used for the task. A 700-token system prompt on a 2048-token context window leaves 1,348 tokens for actual work. That asymmetry is not a configuration issue - it is a fundamental tension between how these tools are designed and how most people actually run them.

Nanocoder v1.26.0 addresses this with a feature I have been thinking about for a while: nano mode.

## What nano mode is

Nano mode is the third tool profile in the `/tune` command, sitting below minimal and above the default. Where minimal trims verbosity, nano mode is built around the constraints of small hardware.

It removes three tools from the default set: `find_files`, `list_directory`, and `agent`. These tools have high overhead - they require the model to reason about multiple files, directory structures, or nested agent contexts. On a 1B or 3B model, that overhead compounds. Nano mode strips them and leaves the tools that do one thing reliably: read, write, search, execute.

The system prompt sections are compressed. `CORE PRINCIPLES` and `CODING PRACTICES` become single-line or absent. `TASK APPROACH`, `FILE OPERATIONS`, and `CONSTRAINTS` are 4-line blocks. The `SYSTEM INFORMATION` block (which in default mode includes detailed OS, shell, and home directory information) becomes a one-liner: `## SYSTEM`. The result is a system prompt of roughly 150-250 tokens against 500-700 in minimal mode. The model gets 60-70% more space to work with.

There is a preset built in for low-end hardware, and an `Include AGENTS.md` toggle so you can opt back in when your setup handles it.

## Why the architecture looks this way

The choice to remove tools rather than reduce their scope comes from something I keep running into: it is not that small models cannot use these tools, it is that the reasoning overhead is disproportionate to what they can handle. A 7B model can manage a `find_files` call and return something useful. A 1B model can do it, but the token cost is higher relative to the output.

The architectural principle is resource-aware tool selection - matching tool complexity to model capacity, not just model capability. Capability is what the model can do in a vacuum. Capacity is what the model can do under the constraints it actually runs under.

This is the same reasoning that led to the `disabledTools` option in this release: the ability to disable specific built-in tools project-wide so you can tune the toolset to exactly what your setup handles. Whether it is nano mode or a custom configuration, the goal is the same - the model should be working with the resources it actually has, not the resources we wish it had.

## Reasoning traces: what shipped and why

The second notable addition is real-time reasoning trace rendering.

Models like Codex GPT-5, DeepSeek-R1-style models, and Anthropic's extended thinking produce intermediate reasoning content as they work through a problem. This content is signal - it shows how the model is approaching the task, where it is considering alternatives, what it is ruling out. But in most tooling, it either does not surface or it surfaces in a way that breaks the reading flow.

Nanocoder now streams this content as a collapsible Thought block above the response. It persists across conversation history and appears in logs. `Control+R` toggles expansion. The Display Settings panel handles the default behaviour.

The architectural decision here was to render reasoning content as a first-class element rather than a debug output. That distinction matters for how you interact with the tool. When reasoning is visible, you stop treating the response as a black box - you can see the structure of the model's thinking and evaluate whether it aligns with what you are trying to accomplish. For anyone working on complex problems or trying to understand where a model's approach goes wrong, that is a significant change in the working relationship.

The reasoning traces also survive correctly across recursive conversation turns and follow-up queries. Getting that right required work at the session persistence layer - the challenge was not rendering the content, it was making sure it remained coherent across a full conversation lifecycle.

## The `--plain` flag for non-interactive use

The third addition is straightforward but I find myself using it constantly: `--plain` strips Ink rendering entirely in non-interactive mode.

The use case is CI pipelines, shell scripts, and programmatic calls. If you are running Nanocoder as part of a build step, you do not want terminal colours, progress indicators, or interactive prompts. You want clean stdout, deterministic exit codes, and output that is safe to pipe.

`--plain` gives you that. Deterministic exit codes, clean stdin/stdout handling, no interactive prompts. Some problems do not need a terminal with good taste.

## What is next

The direction is clear: more resource-aware tooling, better visibility into model reasoning, and deeper support for non-interactive and programmatic use cases.

The reasoning trace rendering opens up work on trace analysis - understanding what patterns emerge in reasoning content and how they relate to output quality. That is not shipped yet, but the architecture now makes it tractable.

Nano mode is the template for how we think about model-specific configurations going forward. Rather than a single tool profile that gets throttled for smaller setups, the architecture supports profiles that are genuinely designed around the constraints they run under. The next step is making that configurable at the project level rather than the session level.

If you are running Nanocoder on hardware with limited resources, nano mode is worth trying. The [Nano Collective](https://nanocollective.org) is where the work lives.

Built by the [Nano Collective](https://nanocollective.org) - a community collective building AI tooling not for profit, but for the community.

https://github.com/Nano-Collective/nanocoder