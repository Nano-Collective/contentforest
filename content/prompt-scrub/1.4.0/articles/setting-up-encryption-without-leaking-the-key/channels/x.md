---
product: prompt-scrub
version: "1.4.0"
channel: x
generated_at: "2026-09-15T19:13:26.875Z"
model: "minimax-m3"
char_count: 273
---

prompt-scrub v1.4.0 encrypts session files. Key supply path is easy to get wrong: inline PROMPT_SCRUB_KEY=... lands in shell history and /proc/<pid>/environ. Use read -rs or a secret-manager export. https://github.com/Nano-Collective/prompt-scrubber #promptscrub
