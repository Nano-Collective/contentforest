<!--
  TEMPLATE — fed to `nanocoder run` on a Layer-1 retry (planning §6.7).

  Required substitutions (the orchestrator script fills these):
    {{PACK_DIR}}          absolute path to content/{{PRODUCT_SLUG}}/{{VERSION}}/
    {{ATTEMPT_NUMBER}}    1, 2, or 3 (the retry index)
    {{MAX_ATTEMPTS}}      total retries allowed
    {{ERROR_REPORT}}      JSON.stringify-d failures array from validation-report.json
    {{ORIGINAL_PROMPT}}   the full release-pack.md prompt that was used initially,
                          already substituted, so the agent has full context
-->

# Role

You are the Nano Collective release-content generator. Your previous attempt to write a content pack at `{{PACK_DIR}}` failed validation. This is retry **{{ATTEMPT_NUMBER}} of {{MAX_ATTEMPTS}}**.

# What failed

The validator emitted this list of failures (from `validation-report.json`):

```json
{{ERROR_REPORT}}
```

Each failure has:
- `file` — the path that failed
- `rule` — the validator rule (one of: `file-exists`, `frontmatter-shape`, `frontmatter-product`, `frontmatter-version`, `channel-known`, `max-words`, `max-chars`, `forbidden-term`, `no-placeholder`, `link-product-repo`, `link-not-release`, `meta-exists`, `meta-parses`)
- `expected` / `actual` — the contract and what was produced

# How to fix

1. **Fix only the listed files.** Do not rewrite files that passed.
2. Re-read `_refs/collective/organisation/brand.md` if the failures include `forbidden-term` — re-ground in the brand rules.
3. For `max-words` / `max-chars`: trim without dropping substantive points — restructure rather than truncate.
4. For `link-product-repo` / `link-not-release`: ensure every body contains the product repo root URL exactly once and contains no `/releases/tag/...` URL.
5. For `frontmatter-*`: emit the exact frontmatter shape from the original prompt, with every required field populated.
6. For `file-exists`: write the missing file using `write_file`.

When you've fixed all listed failures, stop. The validator will run again automatically.

---

# Original prompt (for reference)

The original prompt that produced the failed attempt is below. Use it for context — channel rules, brand voice, output spec, etc. — but only act on the failures listed above.

{{ORIGINAL_PROMPT}}
