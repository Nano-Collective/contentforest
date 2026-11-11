---
product: prompt-scrub
version: "1.5.0"
channel: github-discussion
title: "prompt-scrub v1.5.0: stricter proxy, more detectors, safer sessions"
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 11345
distributed_at: "2026-11-11T10:33:31.728Z"
---

`prompt-scrub` v1.5.0 is out. This release is mostly about the proxy, the detectors, and the session store, and it includes a set of behaviour changes worth reading before you upgrade.

```bash
npm install -g @nanocollective/prompt-scrub
```

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

## The proxy can now fail closed

`prompt-scrub proxy` still forwards requests it does not recognise, such as OpenAI `/v1/responses`, Gemini, Azure OpenAI or Ollama bodies, compressed bodies and non-JSON bodies. That is the right default for a developer tool, because a request you cannot parse is a request you cannot scrub.

The new `--strict` flag removes the default. In strict mode those requests are refused with `403` and never reach the upstream provider. A JSON body sent to a chat endpoint that is not a chat request (a bare string or array, or an object with no `messages` list) is refused too. Blocked requests are counted in `prompt_scrub_blocked_total{reason}` and recorded in the audit log as `rejected` with `errorKind` `strict_blocked`.

```bash
prompt-scrub proxy --target https://api.openai.com --port 8080 --strict
```

`strict` is also available on the programmatic `ProxyOptions`.

## Tool-calling conversations stopped leaking

The proxy used to filter `messages[]` by looking for a `content` key. An assistant turn that carried only `tool_calls` had no `content` key, so it was deleted from the forwarded body. The upstream provider then saw a tool result answering a call it had never been told about.

Messages are now walked rather than filtered. Anything the proxy does not recognise is forwarded unchanged, at its original position.

The same pass covers the fields tool-calling requests actually put text in. All of these were previously forwarded in the clear and are now scrubbed:

- Anthropic's top-level `system` prompt, as a string or as text blocks
- `tool_calls[].function.arguments` and the deprecated `function_call.arguments`
- Anthropic `tool_use.input` and `tool_result` blocks
- the `description` fields of `tools[]` and their JSON schemas
- the deprecated `functions[]` array

Argument strings are parsed and scrubbed value by value, so argument keys and JSON structure survive untouched. Responses are rehydrated in the same places, because the client executes those tool calls on its own machine and needs the real values back.

Tool names, tool-call ids, schema property keys and `enum` values are deliberately left alone. The model has to echo them back verbatim for the caller's dispatch to work.

## The proxy got observability, config reload and bounds

`--audit-log <path>` appends one JSON line per request with counts, detector categories, timings and the request path. The file is created with mode `0600`. Audit records never include values, bodies, headers or query strings.

The proxy also serves `GET /healthz` and `GET /metrics`. Metrics are Prometheus text by default, or JSON with `?format=json`, and cover redaction counts by category, latency, errors and passthrough. `--no-metrics` turns the endpoints off.

```bash
prompt-scrub proxy --target https://api.openai.com --audit-log ./audit.jsonl
```

`config.json` now reloads without a restart, on `SIGHUP` and when the file changes on disk. `rulePacks`, `urlAllowlist`, `minConfidence` and `locale` reload; the other settings need a restart. An invalid config or a rule pack that fails to load keeps the previous configuration in place, and `--no-reload-config` turns reloading off. The proxy also applies the config file's `urlAllowlist` itself now, so the allowlist can reload with everything else.

The proxy no longer grows without bound. Every request without an `x-prompt-scrub-session` header used to create a session that was never freed, so a long-running proxy leaked memory in proportion to its traffic. Sessions are now created only when a request has something to remember, and the least recently used are dropped past `--max-sessions` (default 1000). Binding to a non-loopback `--host` logs a warning. `--auth-token`, or `PROMPT_SCRUB_AUTH_TOKEN`, makes the proxy require an `x-prompt-scrub-token` header on every request except `/healthz`. That header is never forwarded upstream.

## The upstream timeout is no longer 30 seconds

The hardcoded 30 second timeout cut off reasoning models that take longer than that to emit a first token. It is now a 10 minute idle timeout by default, set with `--upstream-timeout <seconds>`, and `0` means no timeout.

A client that hangs up now cancels the upstream request too. Before, a client that disconnected while the upstream was still thinking left the upstream running to completion. The request is dropped and recorded as `client_aborted`.

## New detectors

Four built-in detectors ship in this release:

- `CreditCard`, validated with the Luhn checksum, scored at 0.95
- `Iban`, validated against the country registry and the MOD-97 checksum, scored at 0.95
- `Ssn`, scored at 0.9 when labelled and 0.8 as a bare `123-45-6789`
- `IpAddress`, covering IPv4 and IPv6, scored at 0.85

The `SecretDetector` also grew: Stripe live and restricted keys, JSON Web Tokens, PEM private key blocks (PKCS#8, RSA, EC and OpenSSH, including a key stored in JSON with escaped newlines), GitLab personal access tokens, HuggingFace tokens, npm access tokens, SendGrid API keys and Slack incoming-webhook URLs are all redacted whole as a `Secret` at 0.99 confidence. Credentials after the `Basic` or `token` scheme of an `Authorization` header are detected too, where only `Bearer` was recognised before.

**Behaviour change:** detector priority is now Secret, CreditCard, Iban, Ssn, Email, Url, Path, IpAddress, Phone. Card, IBAN and SSN rank above Email and Url, so a run of digits that used to become `«Phone_N»` can now become `«CreditCard_N»` or `«Ssn_N»`. An IP inside a URL stays part of the `«Url_N»`, because IpAddress ranks below Url.

## Sessions are now locked

Several processes can share one `--session-id` at the same time. `scrub` and the library `scrub()` with a `sessionId` hold an exclusive `<id>.json.lock` file from reading the session until saving it. `sessions encrypt`, `sessions rm` and the session garbage collector take the same lock, so they cannot undo a scrub that is mid-save.

Before, each process read the session on open and rewrote the whole file on save, so parallel runs gave the same placeholder to different values and the last save erased the others' mappings. A process now waits up to 30 seconds for the one ahead of it.

The wait is synchronous. While another process holds the lock, `scrub()` blocks the event loop of a library caller for up to 30 seconds and then throws `SessionLockTimeoutError`, which is now exported so a caller can catch it specifically. A server should not share a session ID between processes. Pass `sessionMap` to stay in memory.

Session IDs are validated too. An ID must now be 1 to 255 characters without a path separator, `:`, a Windows-reserved character or a control character, so `--session-id ../../x` can no longer reach outside the sessions directory. Sessions saved by earlier versions under other names can still be listed, read, encrypted and deleted.

## A batch of detector fixes

Several findings that were left in the clear are now caught:

- An email address at the end of a sentence, `alice@example.com.`
- A secret under a quoted key, `{"api_key": "..."}`
- A password containing `!`, `#` or similar, taken whole instead of being cut at the first punctuation mark
- An `Authorization` header carrying a `Basic` or `token` credential
- A long API key redacted only in part, because the `sk-` pattern stopped after 80 characters
- An email or IPv4 address sitting next to an underscore, as in `alice@example.com_backup.zip` or `host_192.168.10.25`
- A `KEY=value` secret whose key came straight after markup, a bracket, a backtick or non-ASCII punctuation

The postal-address detector also stopped flagging ordinary prose. Any number followed later in the sentence by a street suffix used to count, so `There are 42 things you should consider when walking down the st.` was flagged. The street name between the house number and the suffix is now limited to a few short words and cannot run over a second number. `10 Downing St` and `1600 Pennsylvania Ave.` still match.

## Other fixes in the proxy

- Query strings are forwarded upstream again. They used to be dropped, so `?api-version=` on Azure OpenAI, `?key=` on Gemini and `?limit=` on `/v1/models` never reached the provider.
- The `x-prompt-scrub-session` header is no longer forwarded upstream. The ID is stable for a whole session, so a provider receiving it could link every prompt of that session.
- Request logs carry the path only. With `-v`, the full request URL used to be printed, so a provider that takes its key in the query had that key written to stderr.
- A UTF-8 byte order mark at the start of a JSON body is skipped before parsing, so a body from Windows PowerShell is scrubbed rather than forwarded.
- SSE streams that use CRLF or CR line endings are split on the right boundaries, and events are delivered as they arrive.
- A placeholder split across two SSE events in streamed text is held back and joined, rather than reaching the client as a literal `«Email_1»`.
- A literal `«Email_1»` already present in a request is reserved, so the proxy does not mint the same placeholder for a real address and rehydrate the wrong value.
- `minConfidence` and `locale` from `config.json` are applied by the proxy, and `suppressed` counts are reported in events, the audit log and `/metrics`.
- A document with 10,000 findings used to take about 1.7 seconds to scrub. It now takes under 100 milliseconds, with identical output.

## Also fixed

The CLI did nothing when installed globally. npm starts a global install through a symlink in the bin directory, and the entry check compared the symlink path with the real file path, so every command exited 0 without output. The check now resolves symlinks.

A rule pack that fails to load is no longer skipped in silence. `scrub`, `inspect`, `rules list`, `watch` and `proxy` now warn on stderr, once per run, naming the pack and the reason, and carry on without it.

## Upgrading

Read the behaviour changes before you upgrade:

- New session IDs must be 1 to 255 characters without `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>` or `|` and without control characters. Existing session files keep working.
- `scrub()` with a `sessionId` takes a lock and can block for up to 30 seconds, then throw `SessionLockTimeoutError`.
- Detector priority changed with the new detectors, so some placeholders change category.
- The proxy upstream timeout is now a 10 minute idle timeout, query strings are forwarded upstream, the `x-prompt-scrub-session` header is no longer forwarded, and the `passthrough` reason for a compressed body is `compressed body`.

## Contributors

This release shipped thanks to @addyCooks, @akramcodez, @Ciatel-Arlanta, @RealBhupesh, @rohanshrma222, @slopgobblercobbler and @will-lamerton.

First-time contributors: @Ciatel-Arlanta, @RealBhupesh, @rohanshrma222 and @slopgobblercobbler. Welcome, and thank you.

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
