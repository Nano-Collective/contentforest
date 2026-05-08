/**
 * Browser client for the distribute Worker. The Worker holds a fine-grained
 * GitHub PAT and commits a `distributed_at: <ISO>` frontmatter field onto
 * the markdown file at `repoPath`. Cloudflare Access in front of the Worker
 * authenticates the caller and supplies their email for commit attribution.
 */
const WORKER_URL = 'https://api.contentforest.nanocollective.org';

export async function markDistributed(
	repoPath: string,
	distributedAt: string,
): Promise<{distributedAt: string}> {
	const res = await fetch(WORKER_URL, {
		method: 'POST',
		credentials: 'include',
		headers: {'content-type': 'application/json'},
		body: JSON.stringify({repoPath, distributedAt}),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `worker responded ${res.status}`);
	}
	const data = (await res.json()) as {distributedAt: string};
	return data;
}
