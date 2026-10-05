---
kind: x-daily
date: "2026-10-05"
source: "json-up"
channel: x
angle: "Type safety is end-to-end or it is not type safety"
generated_at: "2026-10-05T05:44:01.896Z"
model: "minimax-m3"
char_count: 247
---

A Zod schema that infers a wider TS type than it actually parses is the worst kind of bug. It compiles, ships, and lies. json-up widens nothing. If the schema says string, the type is string. If your data is broader, the catch site hears about it.