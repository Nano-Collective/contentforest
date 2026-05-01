---
product: nanocoder
version: "1.25.0"
channel: github-discussion
generated_at: "2026-05-01T16:23:25.085Z"
model: "minimax-m2.7"
char_count: 0
---

# Writing custom subagents for Nanocoder

Built by the [Nano Collective](https://nanocollective.org) — a community collective building AI tooling not for profit, but for the community.

---

v1.25.0 added subagents — isolated child conversations the main agent can delegate to. Two built-ins ship now: Explore (read-only codebase investigation) and Reviewer (code review). But the more interesting part of this feature is that anyone can add their own.

Subagents are defined as markdown files with YAML frontmatter. Drop them in `.nanocoder/agents/` and the main agent can delegate work to them without any code changes to Nanocoder itself.

## The file format

A subagent is a markdown file with a specific frontmatter shape:

```markdown
---
name: local-research
description: Fast local codebase research using Ollama
provider: ollama
model: ministral-3:3b
tools:
  - read_file
  - search_file_contents
  - find_files
  - list_directory
---

You are a codebase research agent. Search and read files to answer questions.
Always use your tools — never guess.
```

The frontmatter controls what the subagent can do:

- `name` — used in error messages and log output. kebab-case, lowercase.
- `description` — shown in `/agents show` and surfaced to the main agent so it knows when to delegate.
- `provider` and `model` — override the main session's provider/model. Useful for running a small specialist model for a narrow task.
- `tools` — an allowlist. The subagent gets this exact set of tools, no more.

The markdown body after the frontmatter is the system prompt for the subagent. It's the instructions that tell it what to do and how to do it.

## Tool selection is a design decision

The `tools` list is the most important part of the frontmatter. It defines the subagent's scope. Narrow scope is usually better — subagents work best when they're doing one thing well.

The built-in Explore agent uses only read-only tools:

```yaml
tools:
  - read_file
  - search_file_contents
  - find_files
  - list_directory
```

This is intentional. It means Explore can never write, execute bash, or modify anything — it can only investigate. The main agent delegates to it when it needs context, not when it needs changes made.

Reviewer uses a different set:

```yaml
tools:
  - read_file
  - git_diff
  - search_file_contents
  - list_directory
```

It has `read_file` and `git_diff` (to look at the diff of a PR or branch), but no write tools and no bash. A review agent shouldn't be making edits.

Contrast that with a subagent you might define for running tests:

```yaml
tools:
  - read_file
  - execute_bash
  - list_directory
```

This one needs `execute_bash` to run test commands, but doesn't need write tools or git write operations.

## Model selection per subagent

`provider` and `model` in the frontmatter let you run a different model for a specific subagent. This is useful when:

- The task is narrow enough that a smaller, faster model handles it well.
- You want to keep a specialised model for a specific role (e.g. an Ollama model running locally for code research).

A subagent running `ministral-3:3b` via Ollama for code investigation means the main conversation stays on your primary provider while the research sub-agent runs locally. The results come back to the main conversation regardless of which model produced them.

## Parallel execution

When the main agent calls the `agent` tool multiple times in a single response, all calls execute concurrently — up to 5 at once, each with independent tool sets and live in-place progress rendering. This means you can structure workflows where multiple subagents work simultaneously on different parts of a problem and return their results to the main conversation.

## Managing subagents

Use the `/agents` command to interact with subagents:

- `/agents show` — list all available subagents (built-in and custom).
- `/agents create` — scaffold a new subagent file with the right frontmatter.
- `/agents copy` — duplicate an existing subagent as a starting point for a variant.

Custom subagents live in `.nanocoder/agents/`. Built-in subagents (Explore, Reviewer) are internal and not in that directory.

## What this is good for

The pattern works when you have a recurring task that needs a specific tool set and instructions. Some examples:

**Local-research agent** — restrict to read-only tools, run a small Ollama model, use for gathering context across the codebase without sending that context to an external API.

**Documentation reviewer** — give it `read_file` and `search_file_contents`, run against your docs directory, let it flag broken links or missing sections.

**Dependency auditor** — give it `execute_bash` (with `alwaysAllow` in the session config if you want it to run without prompting), run `pnpm audit` and parse the output.

**Test generator** — scoped to `read_file` and `execute_bash`, reads a file and runs a test command. Can be wired to auto-run via the scheduler.

The key constraint: subagents return only their final result to the main conversation. They don't stream their full working — the main conversation receives the subagent's final output and continues from there. Design your subagent prompts accordingly.

## What subagents don't do

Subagents are not independent agents you can talk to directly — they are delegation targets for the main conversation. You don't chat with a subagent directly; the main agent decides when to delegate and receives the result.

They are also not persistent. Each delegation is a fresh conversation with the subagent's system prompt and tool set. There's no cross-delegation memory unless you structure it into the prompt.

---

Questions, examples, and contributions welcome on [GitHub](https://github.com/Nano-Collective/nanocoder) or [Discord](https://discord.gg/ktPDV6rekE).