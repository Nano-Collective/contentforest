---
product: prompt-scrub
version: "1.5.0"
channel: reddit
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 4689
---

We spent a while working out where a scrubber should draw its line inside a tool-calling request, and the answer turned out to be less obvious than "redact the sensitive bits".

The problem with redacting a tool schema is that a placeholder there does not fail safe. It fails loudly, in a way that is your fault and not the scrubber's.

If you replace a tool name with `«Email_1»`, the model reads that as the tool's name, calls it back as `«Email_1»`, and your dispatcher never matches it. Nothing leaked. The tool just does not run, and the error you get back is some kind of "unknown tool" that has nothing to do with the redaction.

So the rule we settled on for `prompt-scrub` v1.5.0 is not "is this sensitive?". It is "does the model have to reproduce this byte for byte?".

Left alone, on purpose:

- tool names
- tool-call ids
- JSON-schema property keys
- `enum` values

Scrubbed, everywhere else:

- message content and the system prompt
- tool call arguments
- tool results
- the `description` fields inside tool schemas

The schema case is the sharpest example, because a JSON schema is mostly structure with prose buried in it. Our walk goes into the schema and only touches the values of `description` keys. Property names, `type`, `required` and `enum` pass through untouched, even when they look like PII.

This is uncomfortable to write down, so let me write it down: a schema whose `enum` lists customer email addresses is a schema that leaks, and we will forward it as-is. Redacting the enum would not make it private, it would just make the tool wrong, and a broken tool is a worse outcome than the one you are trying to avoid. If you are shipping an enum of real addresses, that is a schema bug, not a scrubber bug.

The other half of the story is tool arguments, where two different rules have to meet.

The proxy parses the arguments JSON, scrubs it leaf by leaf, and tracks the key path as it descends. Keys are never rewritten (a renamed key changes the contract the model is answering), but the key names decide what gets redacted.

We ended up with a dedicated rule for structured data, and it is deliberately stricter than the one we use for prose. The key has to end in a credential word:

- caught: `access_token`, `token`, `clientSecret`, `db_password`, `api_key`, `x-api-key`, `privateKey`, `session_key`, `access_tokens`, `ssh_keys`
- not caught: `key`, `access`, `auth`, `api`, `private`, `pass`, `pwd`, `cred`, `tokenizer`, `token_type`, `secret_name`, `password_hint`

The reason for the strictness is that in a structured payload those generic names are ordinary. `{"key": "logging.level"}` is a key-value store, not a leaked secret. In prose, `key: ...` is a decent hint, so the prose rule stays loose. Two rules, on purpose.

The `tokens` case is the one that took the longest to get right, because the same suffix means two different things:

```
{ "tokens": ["opaque-value-1"], "max_tokens": "4096" }
```

`tokens` is a list of bearer tokens and gets redacted. `max_tokens` is how many tokens the model may spend and does not. A negative lookbehind on a list of count words (`max`, `min`, `prompt`, `completion`, `total`, `input`, `output`, `cached`, `reasoning`, `num`, `new`) tells them apart. `access_tokens` counts as a credential, `prompt_tokens` does not.

Once a key is recognised as a credential key, the value underneath is redacted whole, whatever it looks like. A password of `abc` goes. A passphrase with spaces and a newline in it goes. Everything nested beneath that key goes too, objects and arrays included, so `credentials[].hint` gets redacted even though "first pet" is prose.

And that redaction cannot be filtered out by a confidence threshold, because it is scored as certain rather than as a guess. `--min-confidence 1.0` still leaves it in place.

The practical advice if you write tool schemas:

- Keep PII out of tool names and enum values. We will not scrub them, because we cannot.
- Put the prose in `description`. That is the one field inside a schema that gets scrubbed.
- Name credential fields so they end in a credential word. If the field holds a credential, name it so the rule can see it.
- Do not count on the scrubber catching a credential under a badly chosen name. `{"authorization": "Bearer sk-..."}` does not hit the whole-value rule, it goes through the ordinary detectors, which are good but are making a guess.

Two limits worth knowing: arguments that do not parse as JSON are scrubbed as plain text, so the key rule does not apply to them, and the walk stops at 64 levels of nesting, forwarding anything deeper unscrubbed.

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
