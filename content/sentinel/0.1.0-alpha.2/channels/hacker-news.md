---
product: sentinel
version: "0.1.0-alpha.2"
channel: hacker-news
title: "Sentinel v0.1.0-alpha.2: audit-loop fixes (dedup, label creation)"
generated_at: "2026-07-26T21:27:46.762Z"
model: "minimax-m3"
char_count: 414
---

Second alpha of Sentinel, a Nanocoder-driven workflow for running scheduled, configurable security and code audits across a GitHub org and filing the findings as issues. No new features, just fixes from a real-repo run: stable dedup (rule + file + category instead of line-range-dependent hash), and the filer now creates its own labels so a fresh repo actually works. Full write-up: {{link to article on website}}
