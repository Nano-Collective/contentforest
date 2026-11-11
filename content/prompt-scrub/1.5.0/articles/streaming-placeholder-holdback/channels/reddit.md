---
product: prompt-scrub
version: "1.5.0"
channel: reddit
generated_at: "2026-11-10T13:52:51.686Z"
model: "minimax-m3"
char_count: 4832
---

Here is a problem I did not expect to spend time on, and a thing we had to get right before we could call the proxy usable in front of a streaming provider.

`prompt-scrub` swaps identifying content in a prompt for a placeholder like `«Email_1»`, sends the scrubbed prompt to the model, and puts the real value back in the response. On a non-streaming response that is one regex over one body. Easy.

On a streamed response it is not, because of how vendors stream. Most of them emit Server-Sent Events roughly one token per event. `«Email_1»` is seven characters, so it genuinely arrives in two pieces:

```
data: {"choices":[{"index":0,"delta":{"content":"Contact «Email_"}}]}

data: {"choices":[{"index":0,"delta":{"content":"1» today."}}]}
```

The first event has an opening `«` and no closing `»`. It is not a placeholder and it is not text, it is half of a placeholder that has not finished arriving. Rehydrate each event independently and the client gets the literal string `«Email_1»` where the email address should be. We had this bug for real. Tool-call arguments had always handled it, because a tool call streams its argument string in fragments that the client reassembles anyway, but the plain text path did not, and it should have.

**The fix is to stop treating an event boundary as a text boundary.** When a fragment arrives, the proxy looks at its tail. If it starts with `«` and has no `»` after it, that tail is held back rather than emitted, and joined to the next fragment for the same text or tool call.

Two things stop that from being a footgun:

- The hold is bounded. Placeholders are short, so only a tail up to 48 characters with no whitespace in it is held. Prose that ends `il a dit « bonjour` streams on immediately. Without that bound, a stray guillemet in a sentence would stall the stream forever.
- Held fragments are keyed by what they belong to: provider, choice or block index, and field. So `openai:0:content`, `openai:0:0` for a tool call's arguments, `anthropic:0:text`, `anthropic:0` for an `input_json_delta`. Two tool calls streaming at once each hold their own tail, and a tail held for call 0 never lands in call 1's arguments.

**Event boundaries turned out to be the other half of the job.** The old code split events on `\n\n`. That string never appears in `\r\n\r\n`, so a CRLF-framed stream was held back until the upstream finished (one long pause, then the whole response at once, which defeats the point of a streaming proxy) and a CR-only stream was never rehydrated at all. Boundaries now follow the SSE rules: a line ends with CRLF, a lone CR or a lone LF, and an event ends at two terminators in a row. The fiddly bit is that a CR followed by an LF is one terminator, not two, so the lone-CR branch needs a negative lookahead or every CRLF event gets cut in half. And a chunk can land between the CR and the LF, so a trailing CR at the end of a buffer is held back until the next chunk proves whether it was a terminator or half a CRLF.

**The part that took the most care was the release ordering.** A held fragment has to reach the client *before* the event that ends its text. An SDK stops reading at `finish_reason`, `content_block_stop`, `message_stop` or `[DONE]`, so if you release the tail after that event, the bytes get written to the socket and nobody consumes them. The proxy works out which held tails each event ends, and releases them before it. There is one wrinkle: an OpenAI chunk can carry a `finish_reason` *and* the final fragment of content in the same event, and that fragment may be what completes the placeholder. Release the tail first and you send it twice. So in that case the event is transformed first, and the tail goes after.

One more thing I had to get right, which is easy to miss: the restored value has to be escaped for the context it lands in. A slice of `arguments` sits inside a JSON string literal the client will reassemble, so `C:\Users\alice` has to arrive as `C:\\Users\\alice` or the client's own parse throws. Plain `delta.content` is serialised with the rest of its event, so its values go in unescaped.

And if a held fragment is never completed at all, because the stream was truncated, it is still released verbatim. The tempting move is to drop it, since it cannot be rehydrated and it looks like noise. But dropping it leaves the client's output short of what the model actually produced, and that mismatch is far harder to debug than a stray `«`.

All of this shipped in `prompt-scrub` v1.5.0, alongside the new detectors, the locked sessions and the strict proxy mode. If you want to read the code, it is all in `src/proxy/response-transform.ts`, and the tests spell out each case:

```bash
npm install -g @nanocollective/prompt-scrub
```

Source and issue tracker: https://github.com/Nano-Collective/prompt-scrubber
