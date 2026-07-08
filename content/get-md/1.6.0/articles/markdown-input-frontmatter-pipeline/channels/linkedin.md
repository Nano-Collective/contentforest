---
product: get-md
version: "1.6.0"
channel: linkedin
generated_at: "2026-07-08T16:13:06.512Z"
model: "minimax-m3"
char_count: 3096
---

get-md v1.6.0 added a Markdown input path that the release notes summarised in a single line: "skips HTML parsing and runs only the optimization passes." That line carries more weight than it looks like it does, and the fix underneath it is the one that makes mixed-corpus ingestion usable in practice.

The angle worth explaining: a RAG pipeline that ingests from multiple formats (HTML pages exported from a CMS, PDFs from research portals, DOCX files from collaborators, and an existing folder of Markdown notes) needs the same shape out of every source. The same `convertToMarkdown(buffer, options)` call now handles all four. PDFs land with `title`/`author`/`publishedTime` from the PDF info dictionary; DOCX with `title` from document properties; HTML strings with `title` from `<title>` or Open Graph; Markdown files with `title` from existing frontmatter (when present) or the first H1 (when not). `wordCount` and `readingTime` come back the same shape regardless of source, computed by the same body-text logic every time. `includeLinks`/`includeImages`/`includeTables` apply uniformly.

The hard part was the Markdown input itself. Two pre-1.6.0 behaviours that bit real corpora: a `.md` file that already had its own YAML block would either get a second block stacked on top, or have its real `title` clobbered by the converter's body heuristic. Both are fixed. The fix is structural: `convertMarkdownInput` splits the existing frontmatter off the body before anything else runs, parses the existing keys into a map, and uses them as the authoritative source for `title`, `author`, and `excerpt`. The author's values win. Only computed `wordCount` and `readingTime` are appended, and only if those keys are not already present. One YAML block out, one YAML block in. No second block. No clobbering.

The same review pass also caught that `--no-links`, `--no-images`, and `--no-tables` were not being honoured on the Markdown path. That is fixed too. The Markdown input path now sits on the same content-filtering contract as the HTML path, so the same flags produce the same body shape regardless of source format.

What the function does not do: it does not run Readability (no HTML to extract from), does not call the LLM converter (no structure to recover), does not parse HTML embedded inside Markdown (CommonMark allows it; the GFM-table filter leaves HTML tables alone, which is documented behaviour), and does not split multi-document YAML streams (use `chunkMarkdown` for that).

For mixed-corpus RAG work, the short version: existing Markdown files are no longer the awkward case. The same `convertToMarkdown` call handles them alongside HTML, PDF, and DOCX, the metadata contract is uniform, and a real `.md` file with its own frontmatter survives the round trip unchanged except for appended stats.

```
npm install @nanocollective/get-md@1.6.0
```

Built by the Nano Collective, a community collective building open-source AI tooling not for profit, but for the community.

Repo: https://github.com/Nano-Collective/get-md
Docs: https://docs.nanocollective.org/get-md/docs