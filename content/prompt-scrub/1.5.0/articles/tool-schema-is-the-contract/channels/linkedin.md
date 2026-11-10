---
product: prompt-scrub
version: "1.5.0"
channel: linkedin
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 3051
---

A scrubber in front of an LLM API has to decide, for every string it forwards, whether to redact it. For free text the answer is easy. For tool definitions it is not, and getting it wrong does not leak anything. It breaks the call.

A tool schema is a contract. The model has to echo parts of it back verbatim, so the caller's dispatch can find the right handler. Put a placeholder where a tool name was and the model returns `«Email_1»` as the tool name, the `switch` falls through, and the tool never runs. That happens whether or not the original value was sensitive.

So `prompt-scrub` v1.5.0 draws the line somewhere other than "is this sensitive?". The line is "does the model have to reproduce this byte for byte?".

Left alone, by design: tool names, tool-call ids, JSON-schema property keys, `enum` values. Scrubbed: message content, the system prompt, tool call arguments, tool results, and the `description` fields inside tool schemas.

That last one is worth being precise about. A JSON schema is mostly structure with prose buried in it. The proxy scrubs only the values of `description` keys. Property names, `type`, `required` and `enum` values are structure, so they pass through untouched even when they look like PII. A schema whose `enum` lists customer email addresses is one you should not ship, but redacting that list would not make it private, it would just make the tool wrong.

Tool arguments are the interesting case, because two rules meet there. The proxy parses the arguments JSON, scrubs it leaf by leaf, and tracks the key path as it goes. Keys are never rewritten, because a renamed key changes the contract the model is answering. But the key names decide what gets redacted.

The rule is that the key has to end in a credential word. `access_token`, `client_secret`, `db_password`, `api_key`, `session_key` and `access_tokens` count. Bare `key`, `access`, `auth`, `api`, `private`, `pass` and `pwd` do not, because in a structured payload those are ordinary field names. `{"key": "logging.level"}` is not a secret. Neither do `tokenizer`, `token_type`, `secret_name` or `password_hint`.

And `max_tokens` does not count, while `tokens` does. A count word before the plural disqualifies it. `max_tokens` is a number the model may spend. `access_tokens` is a list of bearer tokens. Same suffix, different thing.

Once a key is recognised, the value beneath it is redacted whole, whatever it looks like. A password of `abc` is redacted. So is a passphrase with spaces and newlines in it. And because that finding is scored as certain rather than as a guess, no `--min-confidence` threshold can un-redact it, even at 1.0.

The upshot for anyone writing tool schemas: keep PII out of tool names and enums, because the scrubber will not touch them. Put the prose in `description`, because that is the one field that does get scrubbed. Name credential fields so they end in a credential word, and do not expect a badly named field to be caught.


Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
