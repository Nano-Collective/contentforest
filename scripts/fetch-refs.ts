/**
 * Fetches the Nano Collective docs index (`llms.txt`) and every doc URL it
 * references into the local `_refs/` directory, so the generator agent can
 * read them as plain files at agent time.
 *
 * Failure is loud by design — if the docs site is down or any referenced doc
 * 404s, the workflow fails and a human picks it up. Pass `--allow-partial`
 * for local prompt-tuning sessions where one broken link shouldn't stop you.
 *
 *   pnpm fetch-refs
 *   pnpm fetch-refs -- --allow-partial
 *   pnpm fetch-refs -- --base https://docs.nanocollective.org
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {parseArgs} from 'node:util';

const REFS_DIR = join(process.cwd(), '_refs');

export type Args = {
	base: string;
	allowPartial: boolean;
};

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			base: {type: 'string', default: 'https://docs.nanocollective.org'},
			'allow-partial': {type: 'boolean', default: false},
		},
	});
	return {
		base: (values.base as string).replace(/\/$/, ''),
		allowPartial: values['allow-partial'] as boolean,
	};
}

async function fetchText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`${url} → ${res.status} ${res.statusText}`);
	}
	return res.text();
}
/* c8 ignore stop */

/**
 * Pulls every URL out of the llms.txt body. llms.txt is loose markdown — the
 * canonical format uses markdown links and bare URLs. We accept both.
 */
export function extractDocUrls(body: string, base: string): string[] {
	const urls = new Set<string>();
	const baseHost = new URL(base).host;

	const mdLink = /\[[^\]]*\]\(([^)\s]+)\)/g;
	for (const match of body.matchAll(mdLink)) {
		urls.add(match[1]);
	}

	const bareUrl = /https?:\/\/[^\s)>\]]+/g;
	for (const match of body.matchAll(bareUrl)) {
		urls.add(match[0]);
	}

	return [...urls]
		.map(u => {
			try {
				return new URL(u, `${base}/`).toString();
			} catch {
				return null;
			}
		})
		.filter((u): u is string => u !== null)
		.filter(u => new URL(u).host === baseHost)
		.filter(u => u.endsWith('.md') || u.endsWith('.txt'));
}

export function localPathFor(url: string, refsDir: string = REFS_DIR): string {
	const u = new URL(url);
	const relative = u.pathname.replace(/^\//, '') || 'index.md';
	return join(refsDir, relative);
}

/* c8 ignore start */
function writeRef(localPath: string, content: string) {
	mkdirSync(dirname(localPath), {recursive: true});
	writeFileSync(localPath, content, 'utf8');
}

async function main() {
	const args = parse();
	const indexUrl = `${args.base}/llms.txt`;

	mkdirSync(REFS_DIR, {recursive: true});

	console.log(`fetch-refs: ${indexUrl}`);
	let indexBody: string;
	try {
		indexBody = await fetchText(indexUrl);
	} catch (e) {
		console.error(`\nFailed to fetch llms.txt: ${(e as Error).message}`);
		console.error(
			'Docs site may be down. The generation pipeline cannot proceed without it.',
		);
		process.exit(1);
	}
	writeRef(join(REFS_DIR, 'llms.txt'), indexBody);

	const urls = extractDocUrls(indexBody, args.base);
	console.log(`fetch-refs: ${urls.length} doc URLs referenced`);

	const failures: string[] = [];
	for (const url of urls) {
		try {
			const body = await fetchText(url);
			const localPath = localPathFor(url);
			writeRef(localPath, body);
			console.log(`  ok  ${url}`);
		} catch (e) {
			const msg = `  FAIL ${url} — ${(e as Error).message}`;
			console.error(msg);
			failures.push(url);
		}
	}

	if (failures.length > 0) {
		if (args.allowPartial) {
			console.warn(
				`\nfetch-refs: ${failures.length} doc URL(s) failed; continuing because --allow-partial.`,
			);
		} else {
			console.error(
				`\nfetch-refs: ${failures.length} doc URL(s) failed. Aborting.`,
			);
			process.exit(1);
		}
	}

	console.log(`\nfetch-refs: wrote ${urls.length + 1} files to _refs/`);
}

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
/* c8 ignore stop */
