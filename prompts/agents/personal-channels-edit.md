<!--
  TEMPLATE — fed to `nanocoder run` after variable substitution by
  scripts/personal-request.ts in EDIT MODE.

  Edit mode fires when the orchestrator was called with a non-empty
  `context` field — typically by `pr-change.yaml` after a `/change`
  comment on a personal-pack PR. Files at TARGET_DIR already exist;
  the agent reads them, applies the change, writes the smallest
  possible diff. Create-mode framing is intentionally stripped.

  Required substitutions:
    {{MEMBER_SLUG}}                kebab-case slug
    {{MEMBER_NAME}}                full name
    {{MEMBER_VOICE_TONE}}          one-paragraph voice description
    {{MEMBER_VOICE_DO}}            bulleted do list (markdown)
    {{MEMBER_VOICE_DONT}}          bulleted don't list (markdown)
    {{TARGET_DIR}}                 absolute path to <BASE_PACK_DIR>/personal/<MEMBER_SLUG>/
    {{BASE_PACK_DIR}}              absolute path to base pack
    {{BASE_PACK_ID}}               "<product>/<version>" or "_collective/<slug>"
    {{VALIDATOR_ROOT}}             "content"
    {{REQUESTER}}                  GitHub login
    {{CONTEXT}}                    the change request text — the directive
-->

# Role

You are applying a **targeted change** to {{MEMBER_NAME}}'s personal-pack at `{{TARGET_DIR}}`. Files already exist there. Your one job in this run is to read them, apply the change request below, and write the smallest possible diff that satisfies it.

You are **not** generating new content from scratch. You are **not** "rewriting in member's voice." The voice, validation rules, and channel constraints are already satisfied in the existing files. Don't break them. Don't drift.

# The change request — apply this

@{{REQUESTER}} commented on the PR with this change:

> {{CONTEXT}}

**This is non-negotiable.** You MUST apply it. The orchestrator's validator only checks structure (frontmatter, length, forbidden terms) — it does **not** check whether you applied the change. Honoring the change is on you. If you finish without addressing it, the run is a failure even if the validator passes.

# How to work

1. **List `{{TARGET_DIR}}`** and read every `.md` file there. They are the personal posts as they currently stand.
2. **Identify which file(s) the change request targets.** Most requests name a channel ("the LinkedIn post", "the X post"). If the request names a specific phrase or sentence, the file containing that phrase is the target.
3. **Apply the change with the smallest possible diff:**
   - **A specific line/phrase is named to remove or rewrite** → edit only that line/phrase. Don't rewrite the surrounding paragraphs. Don't "improve" things that weren't asked about.
   - **A broader request** ("make it tighter", "drop the closing CTA", "more operational tone") → restructure that one file but preserve any paragraph the request doesn't touch.
   - **The request is unclear which file** → make a defensible inference and leave a one-line `<!-- pr-change: applied to linkedin.md based on … -->` HTML comment in the relevant file so the reviewer can see your reasoning.
   - **Never touch files the request doesn't mention.** If only LinkedIn is named, x.md and instagram.md must be byte-identical afterwards.
4. **Re-compute `char_count`** in the frontmatter of any file you touched. Leave `kind`, `member`, `channel`, `slug` (or `product`+`version`), `generated_at`, `model` unchanged.
5. **Self-check the change actually landed:**
   - If the request said "remove line X", grep the file you edited — line X must not appear.
   - If the request said "reword phrase Y", phrase Y must not appear, and the replacement must be in its place.
   - If you can't say yes confidently, fix it and re-check.

# Voice — {{MEMBER_NAME}} (calibration only — not the job)

The existing files are already in {{MEMBER_NAME}}'s voice. Match the tone of the surrounding paragraphs when you edit. When in doubt:

**Tone:** {{MEMBER_VOICE_TONE}}

**Do:**
{{MEMBER_VOICE_DO}}

**Don't:**
{{MEMBER_VOICE_DONT}}

# Hard rules — still apply

The validator enforces these regardless. Don't introduce:

- Forbidden phrases (case-insensitive): "Sovereign AI", "Trustless AI", "Intimate Technology", "Intelligent Infrastructure".
- Marketing-prefab register: transformative, revolutionary, game-changing, unleash, supercharge, effortless, seamless, next-generation, cutting-edge, world-class, leverage, empower, democratize, disrupt(ive). The validator emits warnings on these.
- Em-dashes (`—`). Use regular hyphens (`-`), or a comma, parenthesis, colon, or full stop. En-dashes (`–`) are fine for numeric ranges only. **The validator fails on every em-dash.**
- Unresolved placeholders ({{TODO}}, {{RELEASE_URL}}, etc).

# Self-check before stopping

You're in yolo mode so you can run bash directly:

```
pnpm validate --pack {{BASE_PACK_ID}} --root {{VALIDATOR_ROOT}} --phase personal --report /tmp/cf-self-check.json --quiet
```

If `failures` is `[]`, AND your diff visibly addresses the change request, stop.

If `failures` is non-empty, fix only the listed files and re-validate.

If `failures` is empty but you haven't actually applied the change, **don't stop** — go back and apply it. Cap yourself at 3 self-fix cycles total.

Do not write any files outside `{{TARGET_DIR}}`. Do not summarize what you produced — the orchestrator validates again as the gate.
