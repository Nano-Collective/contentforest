---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:28:32.462Z"
model: "minimax-m3"
char_count: 1589
---

AI tooling has followed the same curve as most infrastructure software: optimise for the machine with the most capacity, and everyone else runs the same stack.

That creates a problem. If you're running a 1B or 3B parameter model on a machine with limited VRAM, system prompt tokens compete directly with task tokens. A 700-token system prompt on a 2048-token context window leaves 1,348 tokens for the actual work. That's not a minor overhead. That's a different ceiling.

Nano mode is the answer I keep coming back to. It drops the system prompt to 150-250 tokens by removing the tools small models can't reliably handle, trimming documentation that the model already knows, and replacing verbose system sections with minimal notes. The model is left to reason with the space it's given, not fight an oversized instruction set to get there.

Reasoning traces are the other thing I find myself pointing at. When a model shows its work - not just the output but the thought process - you stop treating the response as a black box. For anyone debugging or trying to understand how the model is approaching a problem, that changes the relationship you have with the tool.

And for CI and scripting, `--plain` strips the rendering layer entirely. Deterministic exit codes, clean stdin/stdout, no interactive prompts. Some problems don't need a terminal with good taste.

All of this is open source, built by a small team that doesn't answer to anything except the people who use the tools.

[Mind & Machine newsletter](https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728)