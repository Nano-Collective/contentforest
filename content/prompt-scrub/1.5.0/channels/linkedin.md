---
product: prompt-scrub
version: "1.5.0"
channel: linkedin
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 2157
---

`prompt-scrub` v1.5.0 is out. It is a local-first tool that replaces identifying content in prompts with stable placeholders, and rehydrates the model's response locally afterwards.

This release is mostly about the proxy, the detectors, and the session store.

The proxy can now fail closed. `--strict` refuses requests it cannot scrub, such as unrecognised endpoints, compressed bodies and non-JSON bodies, with a `403`, instead of forwarding them unscrubbed. Blocked requests are counted in `prompt_scrub_blocked_total{reason}` and recorded in the audit log.

Tool-calling conversations stopped leaking. The proxy used to drop assistant turns that carried only `tool_calls`, so the upstream provider saw a tool result for a call it had never been told about. Messages are now walked rather than filtered, and the fields tool-calling requests actually put text in, including `tool_calls[].function.arguments`, Anthropic `tool_use.input`, `tool_result` blocks and tool schema descriptions, are scrubbed and rehydrated.

The proxy also gained `--audit-log`, `/healthz`, `/metrics`, config reload without a restart, and an LRU cap on sessions, so it no longer grows without bound. `--auth-token` makes it require a token header on every request except `/healthz`. The upstream timeout moved from a fixed 30 seconds to a 10 minute idle timeout, and a client that hangs up now cancels the upstream request.

Four detectors are new: `CreditCard` (Luhn-checked), `Iban` (mod-97 checked), `Ssn` and `IpAddress`. The secret detector also covers Stripe live keys, JWTs, PEM private key blocks, GitLab, HuggingFace, npm, SendGrid and Slack webhook credentials, and the `Basic` and `token` schemes of an `Authorization` header.

Session files are now locked, so several processes can share one `--session-id` without giving two different values the same placeholder. Session IDs are validated too.

There are behaviour changes around detector priority, session IDs and the proxy timeout, so read the release notes before upgrading.

```bash
npm install -g @nanocollective/prompt-scrub
```

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
