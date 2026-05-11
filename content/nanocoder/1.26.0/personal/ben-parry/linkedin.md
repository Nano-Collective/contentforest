---
kind: personal
member: ben-parry
channel: linkedin
product: nanocoder
version: "1.26.0"
generated_at: "2026-05-11T23:01:16.016Z"
model: "minimax-m2.7"
char_count: 1818
---

Developers have been trained to want more. More models. More context windows. More power.

But the bottleneck in AI tooling is rarely model capability. It is infrastructure and cost.

Small open-weights models can run on hardware that costs less than a monthly cloud API bill. The problem isn't the model. It is the scaffolding around it. System prompts that consume 500-700 tokens before the model says a single useful word. Tool sets designed for beefy cloud setups. Context overhead that burns budget on every single turn.

Nanocoder v1.26.0 ships a third profile under `/tune`: nano mode. It drops the system prompt to roughly 150-250 tokens. It disables three tools (`find_files`, `list_directory`, `agent`) that are unnecessary overhead when you are running a 1B or 3B parameter model on a laptop or a local workstation.

This matters most in industries where the cloud API question is genuinely difficult. A regional healthcare provider running local inference on patient records. A law firm that cannot send client documents to an external API. A financial services company with hard data residency requirements. In these environments, the choice is not "which cloud provider". It is "is on-device AI actually viable?" Nano mode is an answer to that question.

The answer is not better models. The answer is better architecture.

When the scaffolding is light enough, the same model becomes practical. That is what nano mode does, not by shrinking the model, but by shrinking everything around it.

The principle generalises. Accessibility in AI tooling is an architecture problem, not a features problem.

---

I write about this and the other additions in this release, reasoning traces, a `--plain` flag for CI, a reworked VS Code extension, in this week's Mind & Machine.

https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728