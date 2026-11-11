---
product: prompt-scrub
version: "1.5.0"
channel: github-discussion
title: "Why a scrubber has to hold back half a placeholder"
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 15119
---

`prompt-scrub` replaces identifying content in a prompt with a placeholder like `«Email_1»`, sends the scrubbed prompt to the model, and puts the real value back in whatever comes back. On a non-streaming response that is straightforward: the whole body arrives, you run one regex over it, you swap the placeholders.

On a streamed response it is not. This post is about the part that took the most care in v1.5.0: what the proxy does when a placeholder arrives in pieces.

## The problem: the placeholder really does get split

The obvious assumption is that a model echoing a placeholder will emit it whole. It does not.

Vendors stream Server-Sent Events, and most of them emit roughly one token per event. The `«Email_1»` placeholder is seven characters. Depending on how the vendor's tokenizer handles it, that arrives across two events:

```
data: {"choices":[{"index":0,"delta":{"content":"Contact «Email_"}}]}

data: {"choices":[{"index":0,"delta":{"content":"1» today."}}]}
```

The first event carries an opening `«` and no closing `»`. It is not a placeholder. It is not text either. It is the first half of a placeholder that has not finished arriving.

If you rehydrate each event independently, the first event matches nothing and the second matches nothing, and the client receives the literal string `«Email_1»` where an email address should be. Your code now has a placeholder in it instead of data. Worse, in a tool-call argument stream, the placeholder lands in a JSON string that your own tool then parses.

This is not a hypothetical. v1.5.0 fixed exactly this: `delta.content` and Anthropic `text_delta` had been rehydrated per event, so a placeholder split across two events reached the client as a literal `«Email_1»`. Tool-call arguments already handled it, because a tool call streams its argument string in fragments that the client has to reassemble anyway. The text path did not, and it should have.

The fix is to stop treating an event boundary as a text boundary.

## The fix: hold back a trailing partial placeholder

The rule the proxy now applies is narrow. When a fragment arrives, look at its tail. If the tail starts with an opening `«` and has no closing `»` after it, that tail is a placeholder that has not finished arriving, so it is withheld rather than emitted. The next fragment for the same text (or the same tool call) is joined to it, and the combined string is rehydrated.

The test suite states the case directly:

```ts
const out =
  rehydrator.push(Buffer.from(`${contentEvent('Contact «Email_')}\n\n`)) +
  rehydrator.push(Buffer.from(`${contentEvent('1» today.')}\n\n`)) +
  rehydrator.flush();

t.is(collectText(out), 'Contact alice@example.com today.');
```

The first event produces no output at all. The second event carries `«Email_1» today.`, the placeholder is now whole, and the real value goes out in its place.

Two details make this safe rather than merely clever.

**The tail is bounded.** Placeholders are short, so the proxy only holds back a tail up to 48 characters, and only if it contains no whitespace. If a fragment ends with ordinary text that happens to include a `«`, the whole fragment is emitted immediately. A French sentence ending `il a dit « bonjour` streams on without buffering. Without that bound, a stray guillemet in prose would stall the stream indefinitely.

**Held fragments are keyed by what they belong to.** The key encodes the provider, the choice or block index, and the field: `openai:0:content`, `openai:0:0` for a tool call's arguments, `anthropic:0:text`, `anthropic:0` for an `input_json_delta`. Two tool calls streaming at the same time each hold their own tail, and a tail held for call 0 is never spliced into call 1's arguments. The same holds for parallel choices: choice 0 holding `«Em` while choice 1 streams `plain ` does not mix the two.

## Event boundaries: CRLF, CR, LF, and the CR that is only half a terminator

The held-fragment logic is only half the problem. Before the proxy can know where a fragment starts and ends, it has to know where the events are, and that turned out to be harder than splitting on a blank line.

The original code split events on `\n\n`. That works for the common case, and it fails for two others.

A stream framed with CRLF ends its events with `\r\n\r\n`. There is no `\n\n` in that, so a CRLF stream was held back until the upstream finished. The client saw one long pause and then the entire response at once, which is exactly what a streaming proxy exists to avoid. A stream framed with a lone CR was never rehydrated at all, because the terminator pattern never matched.

The proxy now follows the SSE rules for line endings: a line ends with CRLF, a lone CR, or a lone LF, and a blank line, which ends an event, is two terminators in a row. A CR followed by an LF is one terminator, not two. That is the detail most likely to be got wrong, because `split(/\r\n|\r|\n/)` would treat `\r\n` as two breaks and cut every CRLF event in half.

The regex is written so the two cases are distinct:

```ts
const EOL = String.raw`(?:\r\n|\r(?!\n)|\n)`;
const EVENT_BOUNDARY = new RegExp(`${EOL}${EOL}`, 'g');
```

The negative lookahead on the lone-CR branch is what stops a CRLF pair from being counted twice.

There is one more case, and it is the reason the lookahead is not enough on its own. A chunk boundary can land between the CR and the LF of a CRLF. If the proxy sees a trailing CR at the end of the buffer, it cannot yet know whether that CR is a terminator or the first half of a CRLF whose LF is in the next chunk. So that CR is held back and re-examined once more input arrives:

```ts
const held = input.endsWith('\r') ? '\r' : '';
const body = held ? input.slice(0, -1) : input;
```

The test asserts it directly: a chunk ending in `\r` emits nothing, a chunk that is only `\n` still emits nothing (because together they are one terminator), and the following `\r\n` completes the blank line and releases the event.

**Chunk boundaries are handled separately from event boundaries.** A chunk boundary can fall anywhere, including in the middle of a multibyte UTF-8 codepoint, so incomplete bytes are buffered and reassembled by `StringDecoder`. The two are independent concerns, and conflating them is what makes this kind of code fragile. The test suite checks that the output is identical wherever the stream is cut, including cut one character at a time, and that it is identical across all three line-ending conventions:

```ts
test('createSseRehydrator gives the same output wherever the chunks are split', (t) => {
  for (const eol of ['\r\n', '\r', '\n']) {
    const stream = sseStream(eol);
    const expected = runSse([stream]);
    for (let cut = 1; cut < stream.length; cut++) {
      t.is(runSse([stream.slice(0, cut), stream.slice(cut)]), expected);
    }
    t.is(runSse(stream.split('')), expected);
  }
});
```

Output events always use LF, whatever the upstream used. Non-`data:` lines (`event:`, `id:`, `retry:`, `:comment`) are passed through unchanged.

## Releasing a tail that will never be completed

Here is the case that decides whether the design is right.

A fragment arrives that ends mid-placeholder, and the stream then ends without ever completing it. The text was truncated, the upstream closed the connection, the model was cut off mid-word. There is no `»` coming. The placeholder can never be resolved.

The tempting move is to drop the held fragment. It is not a valid placeholder, it cannot be rehydrated, and it is noise.

That is wrong, and the reason is about the client, not the placeholder. A held fragment is bytes that the client is expecting. If the proxy silently drops them, the client's reassembled output is missing a piece, and the client's output no longer matches what the model produced. That mismatch is much harder to debug than a stray `«`.

So the fragment is released verbatim. The test says it plainly:

```ts
test('createSseRehydrator does not lose a tail when the stream ends mid-placeholder', (t) => {
  const rehydrator = createSseRehydrator('openai', ESCAPING_SESSION);
  const out =
    rehydrator.push(Buffer.from(openAiArgEvent('{"p":"«Pa'), 'utf8')) + rehydrator.flush();
  t.is(collectArguments(out), '{"p":"«Pa', 'the held fragment is re-emitted verbatim');
});
```

Handing the bytes over is still better than dropping them.

## Releasing a tail at the end of a stream that did complete

The subtler problem is the reverse: the placeholder is genuinely incomplete, but the stream is over, and the client has stopped reading.

This is where the ordering matters, and it is the part that is easy to get wrong.

An SDK stops consuming the stream when it sees the terminating event: `finish_reason` on an OpenAI choice, `content_block_stop` or `message_stop` on Anthropic, or the `[DONE]` sentinel. If the proxy sends the held fragment *after* that event, the client has already stopped reading, and the fragment is lost anyway. The bytes were written to the socket, but nothing consumes them.

So the release has to happen *before* the terminating event, not after. The proxy inspects each event to work out which held tails it ends, and emits them before the event itself.

```ts
// A tail held mid-placeholder has to reach the client before the event that ends
// its text or call: an SDK stops reading at `[DONE]` or `message_stop`, so a
// fragment sent after it is lost.
const ending = state.tails.size > 0 ? endingTails(event) : undefined;
if (ending?.before) out += releaseTails(state, ending.before);
out += transformSseEvent(state, event);
out += '\n\n';
if (ending?.after) out += releaseTails(state, ending.after);
```

There is one wrinkle. An OpenAI chunk that carries a `finish_reason` can also carry a final fragment of content in the same event, and that fragment may complete the placeholder that is being held. If the tail were released before the event, the client would receive the tail as its own separate event and then receive the completing fragment in the `finish_reason` event, so the tail would be emitted twice.

So for that shape, the tail is released *after* the event, and the event itself is transformed first so its own content already carries the restored value. The code distinguishes the two cases by checking whether the event's delta carries a fragment at all:

```ts
const carriesFragment =
  typeof delta?.content === 'string' || Array.isArray(delta?.tool_calls);
(carriesFragment ? after : before).push(prefix);
```

Which tails an event ends depends on the event:

- `[DONE]` ends every held tail.
- `message_stop` and `message_delta` end every held tail.
- `content_block_stop` ends the tails for that block index only.
- An OpenAI `finish_reason` ends the tails for that choice index.

The release is emitted as a standalone event with the same shape the tail implies, so the client reads it like any other fragment: an OpenAI `delta.content` event for `openai:0:content`, a tool-call `arguments` event for `openai:0:0`, an Anthropic `text_delta` for `anthropic:0:text`, an `input_json_delta` for `anthropic:0`. The client does not need to know any of this happened.

## One more escaping difference between text and arguments

The restored value has to be escaped for the context it lands in, and the two contexts differ.

A slice of `arguments` or `partial_json` sits inside a JSON string literal that the client will reassemble, so a substituted value has to be escaped as that literal's contents. `C:\Users\alice` has to arrive as `C:\\Users\\alice`, or the client's parse of its own tool arguments throws.

Plain text in `delta.content` is serialised with the rest of its event, so its values go in unescaped. The test for that one is explicit:

```ts
t.is(collectText(out), 'Hi Alice "Al" Smith');
```

Getting this backwards in either direction breaks something: escape a plain-text value and the client sees `Alice \"Al\" Smith`; fail to escape an argument value and the client's JSON parse throws on a path it did not generate.

## What this does not do

The proxy does not attempt to repair a stream whose content is truncated for reasons other than an incomplete placeholder. It holds back a trailing partial placeholder and nothing else. It does not buffer whole events to wait for a complete one, it does not reorder anything, and it does not retry.

A payload that is not JSON is passed through untouched, because some vendors emit custom event types and corrupting them would be worse than not rehydrating them.

An unknown placeholder is left as it is. A model can hallucinate a `«Email_9»` that was never in the request, and the proxy has nothing to restore it with, so it passes through. This differs from the library's `rehydrate()`, which reports unknown placeholders as warnings. The proxy stays quiet because the upstream never echoes a placeholder it did not see in the request, so a warning on every chunk would be noise.

## Why this is in the same release as the rest of it

v1.5.0 also changed detector priority, added the `CreditCard`, `Iban`, `Ssn` and `IpAddress` detectors, locked the session files, and gave the proxy a `--strict` mode, an audit log and metrics. The streaming work sits alongside those because it comes from the same place: the proxy is the part of `prompt-scrub` that touches bytes it does not control, and bytes from outside your process are exactly where the interesting failures live.

The two streaming fixes in the changelog are worth reading together:

> Fixed the proxy stalling on event streams that use CRLF line endings. Events were split on `\n\n`, which never appears in `\r\n\r\n`, so a CRLF stream was held back until the upstream finished, and a CR-only stream was never rehydrated. Event boundaries now follow the SSE rules for CRLF, CR and LF, including a CRLF split across two chunks. Events are delivered as they arrive, and output events always use LF.

> Fixed the proxy leaking a placeholder in streamed text. A placeholder split across two SSE events (`«Email_` then `1»`) was only restored in tool-call arguments, so `delta.content` and Anthropic `text_delta` reached the client as a literal `«Email_1»`. A trailing partial placeholder in streamed text is now held back and joined to the next fragment, the same way tool-call arguments already were. A held fragment that is never completed (ordinary text ending in `«`) is released before the event that ends its text or call (`finish_reason`, `content_block_stop`, `message_stop` or `[DONE]`), so a client that stops reading there does not lose it.

If you are running the proxy in front of a provider that streams, this is the part of v1.5.0 most likely to change what you see. If your provider frames with CRLF, you were getting the whole response in one lump. If your model echoes a placeholder in its answer, you were getting the placeholder.

```bash
npm install -g @nanocollective/prompt-scrub
```

Built by the [Nano Collective](https://nanocollective.org), a community collective building AI tooling not for profit, but for the community.

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
