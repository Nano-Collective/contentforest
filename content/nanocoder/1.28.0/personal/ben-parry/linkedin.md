---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T19:50:12.144Z"
model: "minimax-m3"
char_count: 1841
---

Most software doesn't fail because someone wrote the wrong line. It fails because the system around it was never designed to recover.

Think about how a hospital triage desk works. The first nurse isn't diagnosing, she's routing. Severity decides which room, which doctor, how fast. The skill isn't medicine, it's structure. Move that structure around and the medicine doesn't get worse. The whole corridor gets worse.

That's the principle behind the work we shipped in Nanocoder 1.28.0.

The headline is that Nanocoder now speaks the Agent Client Protocol. Run `nanocoder --acp` and the editor becomes the surface. Streaming, diffs, permission prompts, model switching, session modes: all of it lives where the developer is already looking. The terminal stops being the bottleneck. Zed is the first editor to drive it end to end. The editor is doing what triage desks do: routing the work to the right place at the right speed.

But the quieter change matters more. The built-in tool surface dropped from 33 to 19. Tasks, file ops, and git collapsed into single tools. Small local models now get a slimmer tool set automatically, picked from the active model's parameter count. No flag to remember. No config to maintain. The system picks the right shape because the model told it what shape it needed.

This is what architecture looks like when it stops asking the user to compensate for its choices. Less surface to misuse. Less to remember. Less that can go wrong at 2am on a Tuesday.

The principle generalises. Good systems don't trust people to do the right thing. They make the right thing the path of least resistance.

If you want the builder's log of how all of this came together, the architecture decisions, the tradeoffs, subscribe to Mind & Machine: linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728