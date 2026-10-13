---
kind: x-daily
date: "2026-10-12"
source: "sentinel"
channel: x
angle: "Dedup hash is the pack and the file, nothing model-written"
generated_at: "2026-10-12T06:01:24.884Z"
model: "minimax-m3"
char_count: 278
---

Same file, three rule strings: sql/string-concat, sql/string-concatenation, sql/string-concat-user-input. Put the rule in the dedup hash and the finding files three times. Sentinel (alpha) stamps the hash from the validated pack and the file path, not the model's transcription.