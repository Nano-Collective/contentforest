---
kind: personal
member: ben-parry
channel: linkedin-newsletter
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T10:06:12.421Z"
model: "minimax-m2.7"
char_count: 4380
---

The systems we build determine who can use them. This release is about that principle, made concrete.

## Why Nano mode exists

Most AI tooling assumes the developer has access to top-tier hardware. System prompts that consume 500-700 tokens before the model says anything useful are normal in demos. They are not normal on a laptop with 8GB of RAM running a 3B parameter model.

The gap between what gets built and what most developers actually use is structural. It is not a bug. It is a design choice that went unexamined.

Nano mode is a third profile under `/tune`. It drops the system prompt to roughly 150-250 tokens. It achieves this by removing `find_files`, `list_directory`, and `agent` from the tool set; trimming the `CORE PRINCIPLES`, `CODING PRACTICES`, and `CONSTRAINTS` sections to their shortest functional form; and replacing the verbose `SYSTEM INFORMATION` block with a one-line note.

The result works on hardware that the mainstream tooling ecosystem has effectively abandoned. It is not a compromise. It is a different design target.

## Why the architecture looks the way it does

The system prompt is an interface. What you include in it, and what you leave out, determines what the model can do with the information it has. Nano mode is the result of treating that interface seriously for constrained environments.

The same principle applies to the broader toolchain. Nanocoder's `/tune` menu offers three profiles for a reason: the right profile depends on the hardware, the model, and the task. No single profile serves all of them well.

Nano mode ships with a "Nano (low-end hardware)" preset and an "Include AGENTS.md" toggle so users can opt back in if their setup handles it. The toggle is intentional. The right answer depends on the specific context, and the system should not make that decision for the user.

## What reasoning traces reveal

Models that emit reasoning content, such as Codex GPT-5, DeepSeek-R1-style models, and Anthropic extended thinking, now have that content stream live as a collapsible Thought block above the response. It persists across the conversation history and appears in logs.

The architectural decision here was to surface reasoning without making it the foreground. Most users do not need to see reasoning traces by default. `Control+R` toggles expansion, and the Display Settings panel controls the default. The information is available; it is not pushed.

This is also a preview of how the tool handles models that expose more of their internal process. As models become more transparent about their reasoning, tooling has to decide how to represent that transparency. Collapsible and toggleable is the right default for most users. It should remain toggleable.

## The --plain flag and non-interactive mode

A new `--plain` flag strips the Ink rendering layer entirely. Output is clean text, suitable for CI pipelines, shell scripts, and programmatic pipes. Exit codes are deterministic. stdin/stdout are handled cleanly. There are no interactive prompts.

The principle: the tool should work in the environment the user is already in, not require them to set up a different environment. CI pipelines are a legitimate first-class use case. The flag makes that use case clean.

## What's next

The pattern in this release is the pattern we are following more broadly. The tool adapts to the environment. It does not require the environment to adapt to it.

More profiles under `/tune` are possible. Per-model configuration is already in place. The next layer is making those configurations easier to discover and apply without requiring the user to understand the underlying token economics.

The architecture is the product. What ships next is a consequence of the decisions already made.

---

Nanocoder is built by the [Nano Collective](https://nanocollective.org) - community tooling that works where you work.
