---
product: prompt-scrub
version: "1.5.0"
channel: linkedin
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 2016
---

A placeholder in a streamed response arrives in pieces, and that turned out to be the fiddliest part of building `prompt-scrub`'s proxy.

Vendors stream Server-Sent Events, roughly one token per event. The placeholder `«Email_1»` is seven characters, so it genuinely arrives as `«Email_` in one event and `1»` in the next. If you rehydrate each event on its own, the client gets the literal string `«Email_1»` where the email address should be.

v1.5.0 fixes that. The proxy now holds back a trailing partial placeholder instead of emitting it, joins it to the next fragment for that same text or tool call, and rehydrates the pair. Held fragments are keyed by provider, choice and field, so two tool calls streaming in parallel never mix. The hold is bounded and only applies to text with no whitespace in it, so ordinary prose containing a `«` streams on without buffering.

Two related fixes came with it. Events were split on `\n\n`, which never appears in `\r\n\r\n`, so a CRLF-framed stream was held back until the upstream finished and a CR-only stream was never rehydrated at all. Boundaries now follow the SSE rules for CRLF, CR and LF, including a CRLF split across two chunks.

The third fix is the one that took the most care. A held fragment has to reach the client *before* the event that ends its text, because an SDK stops reading at `finish_reason` or `[DONE]`. Release it after and the bytes are written to the socket but nobody consumes them. The proxy works out which held tails each event ends, and emits them before that event. If the event also carries the fragment that completes the placeholder, the release goes after instead, so the tail is not sent twice.

If a held fragment is never completed at all, it is still released verbatim. Dropping it would leave the client's output short of what the model produced, which is worse to debug than a stray `«`.

```bash
npm install -g @nanocollective/prompt-scrub
```

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
