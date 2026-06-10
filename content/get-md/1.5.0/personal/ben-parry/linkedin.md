---
kind: personal
member: ben-parry
channel: linkedin
product: get-md
version: "1.5.0"
generated_at: "2026-05-26T22:37:51.060Z"
model: "minimax-m2.7"
char_count: 1942
distributed_at: "2026-06-10T11:10:55.749Z"
---

A hospital tried to buy its way to better outcomes. New equipment, new software, new dashboards. The outcomes didn't change. The problem wasn't the tools. The problem was that the tools were designed around what the hospital thought it needed, not around how care actually flows.

Most AI tooling is built the same way. It ships with a fixed set of assumptions baked in. A specific model. A specific workflow. A specific output format. And those assumptions work fine, until they don't. Until your use case shifts. Until the model changes. Until what you need diverges from what the tool decided on your behalf.

When that happens, you either work around the tool or work around your own workflow. Neither is a good outcome.

get-md's v1.5.0 treats this differently. The LLM backend is pluggable. You configure the provider, the model, the endpoint, and the tool adapts. Not because the team anticipated every use case, but because the architecture was designed to make that kind of change cheap. Env-var substitution keeps API keys out of committed files. Missing provider dependencies surface a clear install message rather than a cryptic error.

The batch and sitemap modes work the same way. They expose the underlying mechanics: concurrency, error handling, path filtering. Rather than hiding them behind abstractions that fit the most common case and break everything else.

This is what tools designed for builders look like. Not a polished surface that covers the obvious use cases, but a clean interface to a system that behaves predictably when you push it somewhere the designers didn't anticipate.

If you're building a content pipeline, an ingestion workflow, or anything that depends on getting clean markdown from unpredictable sources, this is worth a look.

Subscribe to Mind and Machine: linkedin.com/build-relation/newsletter-follow?entityUrn=7222242466664521728