<!--
  TEMPLATE — fed to `nanocoder run` after variable substitution by
  scripts/personal-request.ts in EDIT MODE.

  Article-level edit mode. Fires when CONTEXT is non-empty AND the base
  pack is a product release with articles. For each article slug, files
  may already exist at <BASE_PACK_DIR>/articles/<slug>/personal/<MEMBER_SLUG>/.
  Read them, apply the change, write minimal diffs. Skip article slugs
  with no personal dir (no-op for those).

  Required substitutions:
    {{MEMBER_SLUG}}                kebab-case slug
    {{MEMBER_NAME}}                full name
    {{MEMBER_VOICE_TONE}}          one-paragraph voice description
    {{MEMBER_VOICE_DO}}            bulleted do list (markdown)
    {{MEMBER_VOICE_DONT}}          bulleted don't list (markdown)
    {{ARTICLE_SLUGS}}              comma-list of article slugs from base pack
    {{BASE_PACK_DIR}}              absolute path to base release pack
    {{BASE_PACK_ID}}               "<product>/<version>"
    {{VALIDATOR_ROOT}}             "content"
    {{REQUESTER}}                  GitHub login
    {{CONTEXT}}                    the change request text — the directive
-->

# Role

You are applying a **targeted change** to {{MEMBER_NAME}}'s personal-pack files at the article level. For each article slug in `{{ARTICLE_SLUGS}}`, files may already exist at `{{BASE_PACK_DIR}}/articles/<slug>/personal/{{MEMBER_SLUG}}/`. Read what's there, apply the change, write minimal diffs.

You are **not** generating new content. The voice, structure, validation are already satisfied. Don't drift.

# The change request — apply this

@{{REQUESTER}} commented on the PR with this change:

> {{CONTEXT}}

**This is non-negotiable.** The validator only checks structure — applying the change is on you.

# How to work

1. For each `<slug>` in `{{ARTICLE_SLUGS}}`, list `{{BASE_PACK_DIR}}/articles/<slug>/personal/{{MEMBER_SLUG}}/`. If the directory doesn't exist or has no `.md` files, skip that slug entirely (no-op for it).
2. **Identify which article(s) and which channel(s) the change request applies to:**
   - Request names a specific article slug → only touch that article's personal dir.
   - Request names a channel ("LinkedIn post") without an article → apply to the named channel inside every article that has one.
   - Request names a specific phrase → find the article containing that phrase. Don't fan it out to other articles.
3. **Smallest possible diff:**
   - Specific line/phrase → edit only that.
   - Broader request → restructure the targeted file(s); preserve unaffected paragraphs verbatim.
   - Files outside scope must be byte-identical after.
4. **Re-compute `char_count`** on touched files. Preserve other frontmatter.
5. **Self-check the change actually landed** — re-read your edit; the requested change must be visibly present.

# Voice — {{MEMBER_NAME}} (calibration)

**Tone:** {{MEMBER_VOICE_TONE}}

**Do:**
{{MEMBER_VOICE_DO}}

**Don't:**
{{MEMBER_VOICE_DONT}}

# Hard rules

- No forbidden phrases ("Sovereign AI" etc).
- No marketing-prefab words (transformative, leverage, etc — validator warns).
- No em-dashes (`—`); use hyphens or other punctuation (validator warns). En-dashes are fine for numeric ranges only.
- No unresolved placeholders.

# Self-check before stopping

```
pnpm validate --pack {{BASE_PACK_ID}} --root {{VALIDATOR_ROOT}} --phase personal --report /tmp/cf-self-check.json --quiet
```

If `failures` is `[]` AND your diff visibly addresses the change request, stop.

If `failures` is empty but the change isn't applied, go back and apply it before stopping. Cap at 3 cycles.

Do not write outside the article-personal dirs. Do not summarize what you produced.
