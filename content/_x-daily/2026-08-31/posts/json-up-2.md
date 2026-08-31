---
kind: x-daily
date: "2026-08-31"
source: "json-up"
channel: x
angle: "Three errors named for what broke"
generated_at: "2026-08-31T05:38:10.141Z"
model: "minimax-m3"
char_count: 264
---

A bad migration that ships today becomes the incident you debug weeks later. `json-up` names the failure: ValidationError (version + Zod path), MigrationError (up() throw with cause), VersionError (out-of-order or duplicate configs). You read it, you don't guess.
