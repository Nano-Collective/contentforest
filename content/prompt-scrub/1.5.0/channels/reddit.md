---
product: prompt-scrub
version: "1.5.0"
channel: reddit
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 5517
---

We just released `prompt-scrub` v1.5.0. If you have not met the tool yet: it is a local-first utility that replaces identifying content in prompts and messages with stable placeholders before they reach a cloud LLM, then rehydrates the model's response locally so your code still gets the real values back.

This release is mostly about the proxy, the detectors and the session store. Here is what actually changed.

**The proxy can fail closed now.** Until now, `prompt-scrub proxy` forwarded anything it could not parse (OpenAI `/v1/responses`, Gemini, Azure OpenAI, Ollama, compressed bodies, non-JSON bodies) to the upstream provider unscrubbed. That is a reasonable default for a dev tool, but it means a request you cannot scrub is a request that leaves in the clear. The new `--strict` flag refuses those with a `403` and never sends them. Blocked requests show up in `prompt_scrub_blocked_total{reason}` and in the audit log as `rejected`.

**Tool-calling conversations were leaking, and we fixed that.** The proxy filtered `messages[]` by looking for a `content` key. An assistant turn carrying only `tool_calls` had no `content` key, so it got deleted from the forwarded body. The upstream then saw a tool result answering a call it had never been told about. Messages are now walked, never filtered, and anything unrecognised is forwarded unchanged at its original position.

The same pass scrubs the fields tool-calling requests actually put text in. All of these were going upstream in the clear: Anthropic's top-level `system` prompt, `tool_calls[].function.arguments`, `tool_use.input`, `tool_result` blocks, the `description` fields of `tools[]` and their JSON schemas, and the deprecated `function_call.arguments` / `functions[]`. Argument strings are parsed and scrubbed value by value, so the JSON structure and argument keys survive. Responses are rehydrated in the same places, since your code runs those tool calls locally. Tool names, tool-call ids, schema property keys and `enum` values are deliberately left alone, because the model has to echo those back verbatim.

**Observability, config reload and bounds for the proxy.** `--audit-log <path>` writes one JSON line per request with counts, detector categories, timings and the request path. The file is created with mode `0600`, and records never include values, bodies, headers or query strings. `GET /healthz` and `GET /metrics` are there too, Prometheus text by default or JSON with `?format=json`. `config.json` now reloads without a restart, on `SIGHUP` or when the file changes on disk, with `rulePacks`, `urlAllowlist`, `minConfidence` and `locale` reloading. An invalid config or a broken rule pack keeps the previous configuration rather than dropping rules silently.

We also fixed a memory leak: every request without an `x-prompt-scrub-session` header created a session that was never freed, so a long-running proxy grew with traffic. Sessions are now only created when there is something to remember, and the least recently used are dropped past `--max-sessions` (default 1000). `--auth-token` makes the proxy require an `x-prompt-scrub-token` header on every request except `/healthz`, and binding to a non-loopback host logs a warning.

**The upstream timeout is no longer 30 seconds.** The hardcoded timeout cut off reasoning models that take longer to emit a first token. It is now a 10 minute idle timeout, set with `--upstream-timeout <seconds>`, and a client that hangs up now cancels the upstream request instead of leaving it running to completion.

**New detectors.** `CreditCard` (Luhn-checked), `Iban` (mod-97 checked), `Ssn`, and `IpAddress` for IPv4 and IPv6. The secret detector also picked up Stripe live and restricted keys, JWTs, PEM private key blocks (including a key stored in JSON with escaped newlines), GitLab PATs, HuggingFace tokens, npm tokens, SendGrid keys and Slack incoming-webhook URLs, plus the `Basic` and `token` schemes of an `Authorization` header.

One behaviour change to note: detector priority is now Secret, CreditCard, Iban, Ssn, Email, Url, Path, IpAddress, Phone. A run of digits that used to become `«Phone_N»` can now become `«CreditCard_N»` or `«Ssn_N»`.

**Sessions are locked.** Several processes can share one `--session-id` safely now. `scrub` holds an exclusive lock file from reading the session until saving it, and `sessions rm`, `sessions encrypt` and the garbage collector take the same lock. Before, parallel runs gave the same placeholder to different values and the last save erased the other mappings. The wait is synchronous, up to 30 seconds, then `scrub()` throws `SessionLockTimeoutError` (exported, so you can catch it). If you run a server, pass `sessionMap` and stay in memory. Session IDs are validated too, so `--session-id ../../x` can no longer reach outside the sessions directory.

There is a long tail of detector fixes as well: emails at the end of a sentence, secrets under quoted keys, passwords containing punctuation, long API keys that were only half redacted, addresses next to an underscore, `KEY=value` pairs after markup or brackets, and a postal-address detector that used to flag prose like `There are 42 things you should consider when walking down the st.`

Install:

```bash
npm install -g @nanocollective/prompt-scrub
```

There are behaviour changes around detector priority, session IDs and the proxy timeout, so read the release notes before upgrading. Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
