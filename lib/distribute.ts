/**
 * Browser client for the distribute Worker. The Worker holds a fine-grained
 * GitHub PAT and commits a `distributed_at: <ISO>` or `wont_use_at: <ISO>`
 * frontmatter field onto the markdown file at `repoPath`. Cloudflare Access
 * in front of the Worker authenticates the caller and supplies their email
 * for commit attribution.
 */
const WORKER_URL = 'https://api.contentforest.nanocollective.org';

export type MarkStatus = 'distributed' | 'wont_use';

export async function markStatus(
	repoPath: string,
	status: MarkStatus,
	markedAt: string,
): Promise<{markedAt: string}> {
	const res = await fetch(WORKER_URL, {
		method: 'POST',
		credentials: 'include',
		headers: {'content-type': 'application/json'},
		body: JSON.stringify({repoPath, status, markedAt}),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `worker responded ${res.status}`);
	}
	const data = (await res.json()) as {
		markedAt?: string;
		distributedAt?: string;
	};
	return {markedAt: data.markedAt ?? data.distributedAt ?? markedAt};
}
