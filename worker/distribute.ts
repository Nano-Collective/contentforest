// Cloudflare Worker: receive a "mark distributed" request from the
// ContentForest browser, set `distributed_at: <ISO>` in the markdown
// frontmatter at `repoPath`, and commit the change to GitHub via the
// Contents API.
//
// Access control is handled by Cloudflare Access in front of the Worker.
// The signed-in member's email is read from `Cf-Access-Authenticated-User-Email`
// and used as the commit author so each distribution is attributed.
//
// Bindings (set via `wrangler secret put` for sensitive values):
//   GITHUB_TOKEN     — fine-grained PAT scoped to this repo with Contents: Write.
//   GITHUB_REPO      — e.g. "Nano-Collective/contentforest".
//   GITHUB_BRANCH    — branch to commit to (defaults to "main").
//   ALLOWED_ORIGIN   — exact origin allowed for CORS (e.g. "https://contentforest.nanocollective.org").
//   FALLBACK_AUTHOR  — committer email when CF Access header is absent (e.g. local dev).

import {setFrontmatterField} from '../lib/frontmatter';

export interface Env {
	GITHUB_TOKEN: string;
	GITHUB_REPO: string;
	GITHUB_BRANCH?: string;
	ALLOWED_ORIGIN?: string;
	FALLBACK_AUTHOR?: string;
}

type Body = {
	repoPath: string;
	distributedAt: string;
};

const REPO_PATH_RE = /^content\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.md$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const cors = corsHeaders(env, req);
		if (req.method === 'OPTIONS') return new Response(null, {headers: cors});
		if (req.method !== 'POST')
			return json({error: 'method not allowed'}, 405, cors);

		let body: Body;
		try {
			body = (await req.json()) as Body;
		} catch {
			return json({error: 'invalid json'}, 400, cors);
		}
		if (!body || typeof body !== 'object')
			return json({error: 'invalid body'}, 400, cors);
		if (typeof body.repoPath !== 'string' || !REPO_PATH_RE.test(body.repoPath))
			return json({error: 'invalid repoPath'}, 400, cors);
		if (
			typeof body.distributedAt !== 'string' ||
			!ISO_RE.test(body.distributedAt)
		)
			return json({error: 'invalid distributedAt'}, 400, cors);

		const branch = env.GITHUB_BRANCH ?? 'main';
		const userEmail =
			req.headers.get('cf-access-authenticated-user-email') ??
			env.FALLBACK_AUTHOR ??
			'distribute-bot@nanocollective.org';

		const MAX_ATTEMPTS = 4;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const existing = await ghGetFile(env, body.repoPath, branch);
			if (!existing) return json({error: 'file not found'}, 404, cors);

			const updated = setFrontmatterField(
				existing.content,
				'distributed_at',
				body.distributedAt,
			);
			if (updated === existing.content) {
				return json({distributedAt: body.distributedAt, noop: true}, 200, cors);
			}

			const message = `distribute: mark ${body.repoPath} distributed (by ${userEmail})`;
			const putRes = await ghPutFile(
				env,
				body.repoPath,
				branch,
				updated,
				message,
				existing.sha,
				userEmail,
			);
			if (putRes.ok)
				return json({distributedAt: body.distributedAt}, 200, cors);
			if (putRes.status === 409 && attempt < MAX_ATTEMPTS) continue;
			const text = await putRes.text();
			return json(
				{error: 'github commit failed', detail: text, attempts: attempt},
				putRes.status === 409 ? 409 : 500,
				cors,
			);
		}
		return json({error: 'unexpected'}, 500, cors);
	},
};

function corsHeaders(env: Env, req: Request): Record<string, string> {
	const origin = req.headers.get('origin') ?? '';
	const allowed = env.ALLOWED_ORIGIN;
	const allowOrigin =
		allowed && (origin === allowed || allowed === '*')
			? allowed
			: origin || '*';
	return {
		'access-control-allow-origin': allowOrigin,
		'access-control-allow-credentials': 'true',
		'access-control-allow-methods': 'POST, OPTIONS',
		'access-control-allow-headers': 'content-type',
		'access-control-max-age': '86400',
		vary: 'origin',
	};
}

function json(
	data: unknown,
	status: number,
	extraHeaders: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {'content-type': 'application/json', ...extraHeaders},
	});
}

async function ghGetFile(
	env: Env,
	path: string,
	branch: string,
): Promise<{sha: string; content: string} | null> {
	const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
	const res = await fetch(url, {headers: ghHeaders(env)});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`github get failed: ${res.status}`);
	const data = (await res.json()) as {sha: string; content: string};
	return {sha: data.sha, content: base64ToUtf8(data.content)};
}

function base64ToUtf8(b64: string): string {
	const bin = atob(b64.replace(/\n/g, ''));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new TextDecoder('utf-8').decode(bytes);
}

async function ghPutFile(
	env: Env,
	path: string,
	branch: string,
	content: string,
	message: string,
	sha: string,
	authorEmail: string,
): Promise<Response> {
	const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
	const author = {name: authorEmail.split('@')[0], email: authorEmail};
	return fetch(url, {
		method: 'PUT',
		headers: {...ghHeaders(env), 'content-type': 'application/json'},
		body: JSON.stringify({
			message,
			content: utf8ToBase64(content),
			branch,
			sha,
			author,
			committer: author,
		}),
	});
}

function utf8ToBase64(s: string): string {
	const bytes = new TextEncoder().encode(s);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

function ghHeaders(env: Env): Record<string, string> {
	return {
		Authorization: `Bearer ${env.GITHUB_TOKEN}`,
		Accept: 'application/vnd.github+json',
		'User-Agent': 'contentforest-distribute-worker',
		'X-GitHub-Api-Version': '2022-11-28',
	};
}
