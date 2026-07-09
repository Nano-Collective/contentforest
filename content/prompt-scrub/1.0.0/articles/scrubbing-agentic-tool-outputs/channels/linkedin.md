---
product: prompt-scrub
version: "1.0.0"
channel: linkedin
title: ""
generated_at: "2026-07-09T19:23:12.277Z"
model: "minimax-m3"
char_count: 1313
---

A practical how-to we wish more agentic-loop writeups included: every tool result that goes back into an LLM turn should pass through a redactor before it leaves your machine.

In `prompt-scrub v1.0.0`, the same `{ role, content }` message shape that OpenAI and Anthropic expect is the shape `scrub()` walks. Wrap each tool call: invoke the tool, scrub its raw output as a `{ role: 'tool', content }` message, send the scrubbed result to the model, rehydrate the response through the same session. Two mechanical steps, one deterministic session id.

The honest bit: the v1 detector set leaves gaps the docs name explicitly. Relative paths in `ls`-style output are not caught. Internal hostnames in `/etc/hosts` are not caught. PEM-armoured private keys are not caught. The `inspect` command is the right reflex before turning a loop on - pipe representative tool output through it, read the diff, then decide which gap matters for your workflow. Add `codeTellTerms` for the curated allowlist, or add a one-off custom detector via `customDetectors` for the rest.

If you are running an agentic loop on a cloud LLM and you have not yet built this wrapper, the long-form walk-through (message-array shape, gap list, inspect-first workflow) is at the repo.

Source: https://github.com/Nano-Collective/prompt-scrubber
