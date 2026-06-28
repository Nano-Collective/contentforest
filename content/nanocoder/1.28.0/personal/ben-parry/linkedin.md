---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T20:19:16.083Z"
model: "minimax-m3"
char_count: 2076
---

Most software gets used where the vendor placed it.

That sounds obvious. It isn't. The placement decision, terminal vs editor vs web app, is the architecture. Once a tool lives in a terminal panel, every interaction gets filtered through the affordances a terminal can offer: a prompt, some coloured text, a permission yes/no. The richer the work, the more friction that filter creates.

The interesting question isn't "what features does the AI agent have". It's "what environment is the agent allowed to live in". If the answer is "a terminal", you've already constrained the design.

We just shipped Nanocoder 1.28.0, and the change I keep thinking about isn't a feature. It's that the editor is now the UI. Run it with --acp and the editor drives everything: streaming text, before/after diffs, permission prompts, model switching, ask_user options. The four development modes (normal, auto-accept, yolo, plan) become session modes you flip from inside the editor.

The second move is subtler. The built-in tool count went from 33 to 19. Tasks collapsed into one write_tasks. File ops merged into one file_op. Git shrank from eleven tools to six. A new auto profile infers the right tool set from the active model's parameter count and re-resolves live on model switch. Small local models get the slim surface automatically, no config change.

This is what consolidation looks like when it's done for the model, not for the marketing page. The principle: a tool surface should match the cognitive bandwidth of the thing using it. If your local 7B can't juggle 33 tool definitions, the answer isn't better prompting. It's fewer tools.

The third piece is session resume with full history replay. You reopen a thread and the conversation is there instead of an empty screen. Profound for the way people actually work across days.

None of this is the point. The shape of the system underneath is: less surface area, better placement, history that survives a restart. Architecture before features. Always.

The longer version of this is in Mind & Machine. Link in comments.