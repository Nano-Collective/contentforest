---
product: nanocoder
version: "1.28.0"
channel: linkedin
generated_at: "2026-06-21T18:38:50.510Z"
model: "minimax-m3"
char_count: 0
distributed_at: "2026-07-20T14:24:58.716Z"
---

Nanocoder v1.28.0 ships two changes that compound into one quiet usability win.

The built-in tool surface was consolidated from 33 tools down to 19. Tasks collapsed into a single `write_tasks`. File ops merged into one `file_op`. Git shrank to six typed tools, with the long tail routing through `execute_bash`.

On top of that, the new default tune profile is `auto`. It parses a size suffix from the active model id and resolves to `full`, `minimal`, or `nano` at runtime. A 7B local model under `auto` gets the eight-tool minimal allowlist, a 1-3B model gets the five-tool nano set with single-tool enforcement and an ultra-slim prompt, and a cloud model with no size hint gets the full surface unchanged. Switch models mid-session and the profile re-resolves live - the next turn rebuilds the tool list, the system prompt, and the status bar against the new resolved profile.

The tune config resolves through a 5-layer merge (hardcoded defaults -> top-level config -> per-provider config -> user preferences -> session override), so an operator can pin a profile for one provider while letting other providers stay on `auto`. Development modes layer on top of the profile: `plan` + `nano` is the small-model planning setup, `plan` + `minimal` adds the four-tool exploration surface, and `plan` + `full` keeps everything including the read-only git tools.

Full write-up on the Nanocoder repo: https://github.com/Nano-Collective/nanocoder

Built by the Nano Collective - a community collective building AI tooling not for profit, but for the community.
