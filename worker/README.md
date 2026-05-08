# `contentforest-distribute` worker

Cloudflare Worker that handles "Mark distributed" clicks from the
ContentForest UI. It writes `distributed_at: <ISO>` into the markdown
file's frontmatter and commits the change to GitHub via the Contents API.

## Auth model

The Worker is meant to sit **behind a Cloudflare Access policy** scoped to
the same Nano Collective members who can reach `contentforest.nanocollective.org`.
Access proves the caller is a member; the Worker reads
`Cf-Access-Authenticated-User-Email` from the request and uses it as the
commit author for attribution. There is no per-user GitHub OAuth — the
Worker holds one fine-grained PAT.

If no `Cf-Access-Authenticated-User-Email` header is present (e.g. local
`wrangler dev`), the Worker falls back to `FALLBACK_AUTHOR` or a generic
bot identity.

## Bindings

Set in `wrangler.toml` (vars) and `wrangler secret put` (secrets):

| Name              | Where    | Notes                                                                          |
| ----------------- | -------- | ------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`    | secret   | Fine-grained PAT scoped to this repo, `Contents: Write`.                       |
| `GITHUB_REPO`     | var      | `Nano-Collective/contentforest`.                                                |
| `GITHUB_BRANCH`   | var      | Defaults to `main`.                                                            |
| `ALLOWED_ORIGIN`  | var      | Exact site origin for CORS, e.g. `https://contentforest.nanocollective.org`.   |
| `FALLBACK_AUTHOR` | var/secret (optional) | Committer email when CF Access header is absent. Local dev only.   |

## Deploy

```sh
cd worker
wrangler secret put GITHUB_TOKEN  # paste the PAT
wrangler deploy
```

Then attach a Cloudflare Access policy to the Worker route in the
Cloudflare dashboard (same identity provider + group as the site).

## Site config

The Worker URL is hardcoded in `lib/distribute.ts` to
`https://api.contentforest.nanocollective.org`. If you change the route in
`wrangler.toml`, update that constant too.

## Wire format

```http
POST /
Content-Type: application/json

{ "repoPath": "content/nanocoder/1.25.0/channels/linkedin.md",
  "distributedAt": "2026-05-08T10:00:00.000Z" }
```

Responses:

- `200 { distributedAt }` — committed (or no-op if `distributed_at` was
  already set to the same value).
- `400` — bad payload (path doesn't match `^content/.../*.md`, or
  `distributedAt` isn't ISO-8601 UTC).
- `404` — file not found in the repo.
- `409` — sha conflict after retry exhaustion.
- `500` — GitHub API failure.

## Concurrency

GET → mutate → PUT with sha; up to 4 retries on 409. Same pattern as the
sibling `ai-courses-annotations` Worker.
