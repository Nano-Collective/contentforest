---
product: prompt-scrub
version: "1.4.0"
channel: hacker-news
title: "prompt-scrub v1.4.0: opt-in encryption for local session files"
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 311
---

`prompt-scrub` v1.4.0 adds opt-in AES-256-GCM encryption for the local session files that map placeholders back to original values, a typed `SessionDecryptionError`, and a `sessions encrypt` command for migrating existing plaintext sessions. Closes #94. Full write-up here: {{link to article on website}}.