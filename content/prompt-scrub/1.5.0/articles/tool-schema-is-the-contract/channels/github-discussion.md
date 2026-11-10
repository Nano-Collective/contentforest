---
product: prompt-scrub
version: "1.5.0"
channel: github-discussion
title: "Writing tool schemas that survive a scrubber"
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 20098
---

A scrubber sitting in front of an LLM API has to make a decision on every string it forwards: redact it or leave it. For most of the request that decision is easy. Free text gets scrubbed, because free text is where names, emails, paths and credentials live.

Tool definitions are not free text. A tool schema is a contract, and the model has to reproduce parts of it verbatim for the caller's dispatch to work. If a scrubber puts `«Email_1»` where a tool name was, the model will echo `«Email_1»` back as the tool name, and the caller's `switch (call.function.name)` will fall through. That is not a leak. That is a broken tool call, and it happens whether or not the original value was sensitive.

This post is about the rule of thumb that comes out of prompt-scrub v1.5.0: scrub free text everywhere, leave the contract alone, and decide what to redact inside tool arguments with a separate key-name rule that is stricter than the one used for prose.

## The rule

The proxy in `prompt-scrub` v1.5.0 scrubs these parts of a tool-calling request:

| | OpenAI | Anthropic |
| --- | --- | --- |
| Message content | `messages[].content` (string or `text` parts) | `messages[].content` (string or `text` blocks) |
| System prompt | the `role: "system"` message | top-level `system` (string or `text` blocks) |
| Tool call arguments | `messages[].tool_calls[].function.arguments` | `tool_use.input` |
| Tool results | the `role: "tool"` message | `tool_result` blocks, including `text` blocks nested inside them |
| Tool definitions | `tools[].function.description`, plus `description` fields inside `parameters` | `tools[].description`, plus `description` fields inside `input_schema` |
| Deprecated function calling | `messages[].function_call.arguments`, `functions[].description` | none |

And it deliberately leaves these alone:

- tool names
- tool-call ids
- JSON-schema property keys
- `enum` values

The reason is stated in the source, in the comment above `scrubOpenAIChatBody`:

> Deliberately untouched: tool names, tool-call ids, JSON-schema property keys and `enum` values. Those are the contract the model has to echo back verbatim, so a placeholder there would break the caller's dispatch rather than protect anything.

That is the whole rule. The boundary is not "is this sensitive?". It is "does the model have to reproduce this byte for byte?".

## What a schema walk actually does

The schema walk is the clearest example, because a JSON schema is mostly structure with prose buried in it. The proxy descends into it and scrubs only the values of `description` keys:

```ts
function scrubSchemaDescriptions(
  value: unknown,
  scrub: ScrubFn,
  add: Accumulate,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return mapPreservingIdentity(value, (item) =>
      scrubSchemaDescriptions(item, scrub, add, depth + 1),
    );
  }

  const record = asRecord(value);
  if (!record) return value;

  const patch: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const next =
      key === 'description' && typeof item === 'string'
        ? scrubText(item, scrub, add)
        : scrubSchemaDescriptions(item, scrub, add, depth + 1);
    if (next !== item) patch[key] = next;
  }

  if (Object.keys(patch).length === 0) return value;
  return { ...record, ...patch };
}
```

The `key === 'description'` test is the whole contract. Property names, `type`, `required` and `enum` values are structure, so they are left alone even when they look like PII.

The doc comment above it says the same thing:

> Property names, `type`, `required` and `enum` values are structure: the model must reproduce them exactly for the caller's dispatch to work, so they are left alone even when they look like PII.

"Even when they look like PII" is the part worth sitting with. A schema whose `enum` holds a list of customer email addresses is a schema you should not ship. But redacting that list does not make it private, it makes the tool wrong. The scrubber is not going to save you from a schema you wrote badly. What it can do is stop making it worse.

The test that pins the behaviour is in `tests/proxy/request-transform.test.ts`:

```ts
test('scrubOpenAIChatBody scrubs tool descriptions but not names or enum values', (t) => {
  const body = {
    tools: [
      {
        type: 'function',
        function: {
          name: 'notify_john@example.com',
          description: 'Email john@example.com about an order',
          parameters: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Defaults to john@example.com',
                enum: ['john@example.com', 'alice@example.com'],
              },
            },
          },
        },
      },
    ],
  };
  const result = scrubOpenAIChatBody(body, fakeScrub);
  const fn = (result.body as ...).tools[0]?.function;
  t.is(fn?.description, 'Email «Email_1» about an order');
  t.is(fn?.parameters.properties.to.description, 'Defaults to «Email_1»');
  t.is(fn?.name, 'notify_john@example.com', 'tool names must round-trip verbatim');
  t.deepEqual(fn?.parameters.properties.to.enum, ['john@example.com', 'alice@example.com']);
});
```

Two things are redacted, because both are prose a human wrote. Two things are not, because the model has to echo them. The tool name in that test even contains an email address, and it still goes out unchanged.

## Tool arguments are the interesting case

Tool arguments are where the two rules meet. OpenAI sends `tool_calls[].function.arguments` as a JSON-encoded *string*, and Anthropic sends `tool_use.input` as a real object. Both end up in the same place: a JSON value whose string leaves get scrubbed one at a time, with the keys tracked along the way.

The helper that does it is in `src/proxy/json-scrub.ts`:

```ts
export function mapJsonStrings(
  value: unknown,
  fn: JsonTextTransform,
  depth = 0,
  keys: readonly string[] = [],
): { value: unknown; count: number } {
  if (depth > MAX_DEPTH) return { value, count: 0 };

  if (typeof value === 'string') {
    const { content, count } = fn(value, keys);
    return { value: content, count };
  }
  // ...
  if (typeof value === 'object' && value !== null) {
    const next: Record<string, unknown> = {};
    for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
      const result = mapJsonStrings(item, fn, depth + 1, [...keys, name]);
      count += result.count;
      next[name] = result.value;
    }
    return { value: next, count };
  }
  // ...
}
```

Two details matter here.

**Keys are never rewritten, but they are recorded.** The doc comment:

> Object *keys* are never touched - a renamed key changes the contract the model is answering, and keys are structure, not content. The keys a string sits under are passed to `fn` as context, though.

So `{"email": "a@b.com"}` keeps the key `email`. The key is context for the decision, not a thing to change.

**The key path is what decides the decision.** `keys` accumulates the names of the object properties the string sits under, outermost first. An array adds no name of its own, so its items carry the name of the property the array sits under. That is what makes `"password": {"value": "..."}` and `"credentials": [{"value": "..."}]` behave the way you would want.

## The credential-key rule

So: which argument values get redacted?

Not all of them. If a scrubber redacted every string in a tool call, `{"city": "Berlin"}` would come back as `{"city": "«Secret_1»"}` and the tool would be useless. The tool has to receive usable values.

`prompt-scrub` uses a dedicated rule for structured data, and it is deliberately different from the one it uses for prose. Here is the rule as written in `src/detectors/secret.ts`:

```ts
const CREDENTIAL_KEY =
  /(?:token|(?<!(?:max|min|prompt|completion|total|input|output|cached|reasoning|num|new)[_-]?)tokens|secrets?|passw(?:or)?ds?|passphrases?|credentials?|(?:api|access|private|secret|signing|encryption|master|ssh|auth|session)[_-]?keys?)$/;

export function isCredentialKeyName(key: string): boolean {
  return CREDENTIAL_KEY.test(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());
}
```

And the comment above it is the clearest statement of the design in the whole codebase:

> In structured data (tool-call arguments, `metadata`) the key names the field outright, so only a name that ends in a credential word counts, singular or plural (`secrets`, `api_keys`). `key`, `access`, `auth`, `api` or `private` on their own are ordinary field names there (`{"key": "logging.level"}`), where in prose `key: ...` is a good hint. `secret_name`, `token_type` and `tokenizer` do not end in a credential word, and `pwd` is a working directory as often as a password. `tokens` counts too (`tokens`, `access_tokens`), except after a word that makes it a count (`max_tokens`, `prompt_tokens`, `total_tokens`). This is not `isSecretKeyName`, the looser guess that decides whether `key: value` in free text is a secret; the two rules differ on purpose.

There are three ideas packed into that comment.

**The key has to end in a credential word.** `access_token` counts because it ends in `token`. `tokenizer` does not, because it does not end in one. `secret_name` does not. `password_hint` does not. `clientSecret` counts, because the camelCase is split first (`client_Secret` -> `client_secret`) and then lowercased.

**The compound `key` names count, bare `key` does not.** `api_key`, `access_key`, `privateKey`, `secret_key`, `session_key`, `x-api-key` and `ssh_keys` all end in a `key` preceded by a word that says what kind of key it is. A key called just `key` does not, because `{"key": "logging.level"}` is a perfectly ordinary field.

**A count word before `tokens` disqualifies it.** `tokens` and `access_tokens` count. `max_tokens`, `prompt_tokens`, `total_tokens`, `num_tokens`, `completion_tokens`, `max_new_tokens` do not. The negative lookbehind is what does it, and it is the difference between a token count and a token.

That last one is the interesting bit, because the same word means two different things. `access_tokens` is a list of bearer tokens. `max_tokens` is a number the model is allowed to spend. Both end in `tokens`.

## A credential key redacts the whole value, not a guess at it

There is a second rule that applies once a key has been recognised as a credential key, and it is different in kind from everything else in the scrubber.

A string under a credential key is replaced whole, whatever it looks like. Not "matched against secret patterns". Replaced whole.

The implementation is a one-line adaptation in `src/proxy/request-transform.ts`:

```ts
function asJsonTransform(scrub: ScrubFn): JsonTextTransform {
  return (text, keys = []) => {
    const asSecret = keys.some(isCredentialKeyName) && placeholderTokensIn(text)[0] !== text;
    const { content, entities } = asSecret ? scrub(text, true) : scrub(text);
    return { content, count: entities };
  };
}
```

The `asSecret` flag routes the string to `WHOLE_VALUE_SECRET_DETECTOR`, which reports its entire input as one secret:

> Reports its whole input as one secret. The proxy adds it for a string that sits under a credential key, where the key already says the value is a secret, so the value is redacted whatever it looks like (a short password, one holding both quote kinds, a passphrase with spaces) and no other detector can change what is redacted. The finding is certain, not a guess from a key-name hint, so a `minConfidence` threshold, which drops guesses, never drops it.

Two consequences fall out of that.

**The value does not have to look like a secret.** A password of `abc` is redacted. A passphrase of `two\nlines of passphrase` is redacted. The key already said what this is; there is nothing left to guess.

**A confidence threshold cannot un-redact it.** The finding is scored as certain, not as a hint, so `--min-confidence` at 0.99 or even 1.0 still leaves it redacted. The test says so directly:

```ts
test('redacts a value under a credential key whatever minConfidence is set to', (t) => {
  for (const minConfidence of [0.7, 0.8, 0.99, 1]) {
    const { args, entities } = scrubbedArguments({ password: 'secret-value' }, { minConfidence });
    t.deepEqual(args, { password: '«Secret_1»' }, `minConfidence ${minConfidence}`);
    t.is(entities, 1, `minConfidence ${minConfidence}`);
  }
});
```

And the coverage is not just the immediate value. Everything beneath a credential key is covered, nested objects and arrays included:

```ts
test('redacts every string beneath a credential key, nested objects and arrays included', (t) => {
  const { args, entities } = scrubbedArguments({
    password: { value: PASSWORD },
    credentials: [{ value: `${PASSWORD}2`, hint: 'first pet' }],
    config: { auth: { api_key: `${PASSWORD}3` }, secrets: { deep: { deeper: [`${PASSWORD}4`] } } },
    password_hint: 'first pet',
    city: 'Berlin',
  });
  t.deepEqual(args, {
    password: { value: '«Secret_1»' },
    credentials: [{ value: '«Secret_2»', hint: '«Secret_3»' }],
    config: { auth: { api_key: '«Secret_4»' }, secrets: { deep: { deeper: ['«Secret_5»'] } } },
    password_hint: 'first pet',
    city: 'Berlin',
  });
  t.is(entities, 5);
});
```

Note what happens to `credentials[].hint`. It says "first pet", which is prose, not a secret. But it sits under `credentials`, so it is covered. The rule is about the *key path*, not about the value's shape. That is the price of a rule that does not need to guess. And `password_hint` is not covered, because it does not end in a credential word.

## The counter-case: `max_tokens` and friends

The same test file has the counter-case, and it is the one that makes the rule feel deliberate rather than arbitrary:

```ts
test('redacts a list of tokens but leaves a token count alone', (t) => {
  const { args, entities } = scrubbedArguments({
    tokens: ['opaque-value-1', 'opaque-value-2'],
    refresh_tokens: ['opaque-value-3'],
    max_tokens: '4096',
    prompt_tokens: '12',
  });
  t.deepEqual(args, {
    tokens: ['«Secret_1»', '«Secret_2»'],
    refresh_tokens: ['«Secret_3»'],
    max_tokens: '4096',
    prompt_tokens: '12',
  });
  t.is(entities, 3);
});
```

`tokens` and `refresh_tokens` are lists of opaque values that go out redacted. `max_tokens` and `prompt_tokens` come through untouched, even though they are strings, even though they contain the word "tokens", even though a naive substring rule would catch them.

And the broader test of what is left alone:

```ts
test('leaves tool-call arguments under keys that do not name a credential untouched', (t) => {
  for (const args of [
    { city: 'Berlin', title: 'a longer plain sentence here' },
    { key: 'logging.level', value: 'DEBUG' },
    { access: 'read-only' },
    { metadata: { key: 'user-12345' } },
    { auth: 'bearer-style', api: 'v1-endpoint', private: 'yes-private', pass: 'second-pass' },
    { cred: 'abcdefgh1234', pwd: 'working-dir' },
    { tokenizer: 'cl100k_base', secretary: 'Ms Jones here', token_type: 'Bearer' },
    { secret_name: 'prod-db', password_hint: 'first pet', max_tokens: '4096' },
  ]) {
    const body = toolCallBody(args);
    const result = scrubOpenAIChatBody(body, realScrub());
    t.is(result.body, body, JSON.stringify(args));
    t.is(result.entities, 0, JSON.stringify(args));
  }
});
```

`key`, `access`, `auth`, `api`, `private`, `pass`, `cred`, `pwd`. All of them look alarming. All of them are ordinary field names in a structured payload, so all of them go through the ordinary detectors instead of the whole-value rule. If `{"key": "logging.level"}` were redacted whole, every tool that takes a key would break.

## Why two rules rather than one

The prose rule is looser. In free text, `key: something` is a decent hint that `something` is a credential, so `isSecretKeyName` accepts `key`, `keys`, `pass`, `pwd`, `api`, `apikey`, `auth`, `oauth`, `authorization`, `cred`, `creds`, `private`, `access`, `bearer` and `passkey`, or any compound like `apikey`, `secretkey`, `authkey`. The name says it all: it is a guess.

In structured data, the same word is a field name. A tool that takes `{key, value}` for a key-value store is doing something completely ordinary, and a scrubber that redacts its arguments has made the tool unusable. So the structured rule is strict about *shape* (the name has to end in a credential word) and absolute about *scope* (once it matches, the whole subtree goes).

The comment on the source says the two differ on purpose:

> This is not `isSecretKeyName`, the looser guess that decides whether `key: value` in free text is a secret; the two rules differ on purpose.

If you are writing a rule pack, or reasoning about which of your own field names will be caught, that distinction is the thing to hold on to.

## What this means if you write tool schemas

Four practical rules.

**Keep PII out of tool names and enums.** The proxy will not scrub them, because it cannot. A tool named `notify_john@example.com` goes to the provider with the address in it. An `enum` listing customer email addresses does too. Rename the tool, and replace the enum with a lookup or a free-text field.

**Put the prose in `description`.** This is the one field in a schema that gets scrubbed. If a schema needs to say "the account to bill, for example `acme-corp`", that sentence belongs in `description` and it gets scrubbed like any other prose. The property key is what the model echoes, not the description.

**Name your credential fields so they end in a credential word.** `access_token` is caught. `token` is caught. `accessToken` is caught. `auth_bearer` is not, because it does not end in a credential word. If the field holds a credential, name it so the rule can see it. `api_key`, `client_secret`, `db_password`, `session_key`, `ssh_keys` and `access_tokens` all work. `max_tokens` and `token_type` are the shapes that deliberately do not.

**Do not rely on the scrubber to catch a credential in a badly named field.** `{"authorization": "Bearer sk-..."}` does not go through the whole-value rule. It goes through the ordinary detectors, where the `Secret` detector is very good at an `Authorization` header or a `sk-` prefix, but where the decision is a detection rather than a certainty. If a field definitely holds a credential, name it like one.

## What this does not do

It does not make a bad schema private. A schema with customer email addresses in its `enum` is a schema that leaks, and the proxy will forward it unchanged. The rule is about not breaking working tools, not about protecting data you put in the contract.

It does not scrub tool arguments that do not parse as JSON. OpenAI's `tool_calls[].function.arguments` is a JSON-encoded string, and the proxy parses it, scrubs it leaf by leaf and re-serialises it. If it does not parse, it is scrubbed as plain text instead, and the credential-key rule does not apply to it, because there are no keys to look at. A hand-rolled argument blob is a string, and the prose detectors are all it gets.

It does not go below 64 levels. The proxy walks tool arguments, tool schemas and `tool_result` chains to a depth of 64 and forwards anything deeper unscrubbed. That cap keeps a hostile body from exhausting the stack, and nothing legitimate nests that deep.

It does not scrub `messages[].name`, `thinking` blocks, or opaque payloads such as images and `base64` or `url` document sources. A `name` is rejected by the API if it contains anything but `[a-zA-Z0-9_-]`, so a placeholder there would not even be accepted.

And it does not stop you writing a schema with a credential in a property key. The keys are the contract. They go out as they are.

```bash
npm install -g @nanocollective/prompt-scrub
```

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
