---
kind: personal
member: ben-parry
channel: substack
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T10:06:12.421Z"
model: "minimax-m2.7"
char_count: 2541
---

The tools we build determine who can use them. Most AI tooling assumes the developer has access to the hardware at the head of a long tail - top-tier laptops, generous RAM, the latest models running locally at full capacity. The tooling is designed around that assumption. The system prompts alone can consume 500-700 tokens before the model says anything useful. That overhead is invisible in demos. It is very visible on a machine with 8GB of RAM running a 3B parameter model.

The gap between what gets built and what most developers actually use is structural. It is not a bug. It is a design choice that went unexamined.

Nanocoder's new Nano mode is a third profile under `/tune`. It drops the system prompt to roughly 150-250 tokens. It achieves this by removing `find_files`, `list_directory`, and `agent` from the tool set; trimming the `CORE PRINCIPLES`, `CODING PRACTICES`, and `CONSTRAINTS` sections to their shortest functional form; and replacing the verbose `SYSTEM INFORMATION` block with a one-line note.

The result works on hardware that the mainstream tooling ecosystem has effectively abandoned. It is not a compromise. It is a different design target - the same way a hospital does not staff every ward with the same nurse-to-patient ratio, good tooling adapts to the environment it operates in.

Small models on modest hardware are not a niche edge case. They are what most of the world runs. The question is always the same: does the system make what you need accessible on the hardware you have, or does it require you to change your hardware first?

The pattern here extends beyond Nanocoder. As models become more transparent about their reasoning - Codex GPT-5, DeepSeek-R1-style models, Anthropic extended thinking - tooling has to decide how to represent that transparency. Nanocoder surfaces reasoning as a collapsible Thought block, streamed live above the response. `Control+R` toggles expansion. The information is available; it is not pushed.

The broader principle is architecture as product. The right answer for a given context is not a function of which model you use or how much hardware you have. It is a function of how deliberately the tooling around the model was designed. The tools may matter more than the models.

The next layer is making configurations easier to discover and apply without requiring the user to understand the underlying token economics. That work is already underway.

---

Nanocoder is built by the [Nano Collective](https://nanocollective.org) - community tooling that works where you work.
