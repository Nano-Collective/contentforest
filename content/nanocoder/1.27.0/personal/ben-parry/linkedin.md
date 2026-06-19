---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.27.0"
generated_at: "2026-06-02T15:30:53.389Z"
model: "minimax-m3"
char_count: 1887
wont_use_at: "2026-06-19T14:01:33.502Z"
---

Most developer tools wait to be called. You open a terminal, you invoke a command, the tool does a thing, you get a result. This is fine when the work maps neatly onto that interaction pattern. It stops being fine when the work is continuous.

A CI pipeline that runs on a timer has no idea what changed. A webhook that fires on every push knows exactly what changed. The difference is not speed. It is whether the system has a model of the world it is operating in, or whether it is flying blind and hoping the schedule is close enough.

The first is configuration. The second is intent.

Nanocoder v1.27.0 implements the second pattern. It ships with a background daemon that monitors your project and responds when something relevant changes. File saves. Cron schedules. Custom events you define. When the right signal fires, a Nanocoder session runs headlessly and does the thing it was built to do.

The daemon would not be interesting on its own. Long-running processes exist everywhere. What makes this architecture hold together is the extension surface beneath it: Skills, a unified model for commands, tools, and subagents that packages them into composable, versioned bundles with shared context. Custom Tools that let the model invoke your shell scripts directly, with parameter declarations and shell-quoted substitution to prevent injection. The daemon runs when these pieces can work together.

The answer is not a background process. The answer is a background process built on top of a composable architecture, so that the right signal can trigger the right behaviour without manual invocation.

This is the same shift that made modern CI what it is, or that made operating systems responsive rather than batch-processors. Systems that respond to what happens in them are more resilient than systems that depend on getting called at the right time.

AI tooling that runs on demand is a very good hammer. AI tooling that runs when the relevant event fires is something different.

I write about this at Mind and Machine.