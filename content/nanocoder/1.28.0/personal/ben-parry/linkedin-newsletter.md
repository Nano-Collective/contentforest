---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T19:50:12.144Z"
model: "minimax-m3"
char_count: 5664
---

# Mind & Machine, Issue 7

## The terminal was never the product

For most of the last two years, Nanocoder has been a terminal application. That was always a constraint, not a destination. The terminal is where the early adopters lived, where the model could be exercised honestly, and where the surface stayed small enough to redesign every two weeks without apology.

But a terminal is also a corridor with one door. Every diff, every permission prompt, every mode decision has to be serialised as text and parsed back. The model can produce the right action, but the human still has to live inside a 1980s interface to approve it.

In Nanocoder 1.28.0 we shipped the thing that fixes that, and a quieter thing underneath it that matters more. Both decisions trace back to the same principle.

## The structural problem

The hardest part of building an agent isn't the model. It's the surface around the model.

A coding agent lives in three places at once: the editor where you read code, the terminal where you run commands, and the chat where you and the model negotiate. When those three places have to stay in sync by hand, the human becomes the message bus. Every model output is a context switch. Every tool call is a copy-paste. Every permission prompt is a delay you have to recover from.

We don't think the human should be the message bus. The human should be the decision-maker. Everything else is plumbing, and plumbing should be invisible.

## What shipped: Agent Client Protocol

Nanocoder 1.28.0 can now run as an Agent Client Protocol server. Run `nanocoder --acp` and the editor becomes the UI.

What that means in practice: streaming text, tool cards, before/after diffs for `string_replace` and `write_file`, permission prompts, model switching, and `ask_user` options all render in the editor instead of the terminal. The four development modes (normal, auto-accept, yolo, plan) are exposed as session modes selectable from the editor. Sessions start in auto-accept. The first editor to drive this end to end is Zed; the registration is two lines in `settings.json`.

Under the hood it's JSON-RPC over stdin/stdout. The new module lives at `source/acp/` and covers the agent, server, session, conversation loop, content conversion, capability negotiation, and permission handling. Thanks to @Avtrkrb for driving it. Closes #529.

The architectural decision that mattered: we did not fork the conversation loop. The ACP server sits beside the existing one. Same turn-taking, same tool execution, same permission model. The editor changes. The agent doesn't. The interface is replaceable. The reasoning is not.

## What shipped: 33 tools became 19

The quieter change is the one we spent more time on.

The built-in tool surface dropped from 33 to 19. Tasks collapsed into a single `write_tasks` that replaces the whole list (no IDs for the model to juggle). File ops merged `delete`, `move`, `copy`, and `create_directory` into one `file_op`. Git shrank from eleven tools to six.

Roughly 6.3k lines went out with this work. Most of them were deletions.

Alongside the consolidation, the `auto` tune profile is now the default. It infers `full`, `minimal`, or `nano` from the active model's parameter count, re-resolves live on model switch, and surfaces in the input indicator. Small local models get the slim tool set and a shorter prompt automatically. No flag. No config. The system picks the right shape because the model told it what shape it needed.

## Why the architecture looks this way

A tool surface is a contract. Every tool is a promise to the model: if you call me with this shape, I will return this kind of result. The more contracts you sign, the more you have to maintain. The more you have to maintain, the more can drift. The more that can drift, the more the model has to guess.

Models are good at guessing. Guessing is not what you want when the guess is `rm -rf`.

Eleven git tools means eleven ways to do a commit, and eleven ways for the model to pick the wrong one. Six git tools means six contracts to keep honest, and one obvious path to follow. The same logic applies to the auto profile. A 3B parameter model on a laptop doesn't need the same toolset as a 70B model in a data centre. Forcing it to choose from 33 tools is asking a small model to be a careful librarian. Give it 8 tools and let it be a careful worker instead.

The principle: less surface to misuse. Less to remember. Less that can go wrong at 2am on a Tuesday.

## The principle behind the work

Good systems don't trust people to do the right thing. They make the right thing the path of least resistance.

That's the through-line. ACP doesn't trust the user to copy diffs from the terminal into the editor. The editor just gets them. The auto profile doesn't trust the user to pick the right toolset for their model. The model picks it. Read-before-edit guards on `string_replace` and `write_file` don't trust the user to check. The system checks.

The product is the proof. The principle is the product.

## What's next

Two directions, both architectural inevitabilities rather than promises.

First, more editors. ACP is a protocol, not a Zed integration. Every editor that ships ACP support will get Nanocoder for free. That's the whole point of protocols.

Second, the tool surface keeps shrinking. The consolidation from 33 to 19 isn't the last pass. As models get better at reading and writing structured intent, the surface area collapses further. The endpoint isn't zero tools. The endpoint is tools that are obvious enough that the model picks the right one without thinking.

Full release notes and changelog: nanocollective.org