/**
 * Auto-publisher for the calendar's `github-discussion` items: when a
 * scheduled day arrives, post the item to GitHub Discussions on the org repo
 * with the right category + labels, then stamp `distributed_at` so the
 * calendar (and the planner's reflow) treat it exactly like a manual
 * "Mark distributed".
 *
 * Selection: scan every ledger under content/_calendar/ and collect items with
 * channel "github-discussion" whose day is today or earlier (overdue items
 * from failed runs catch up) and whose target file is still unused (no
 * distributed_at / wont_use_at). Frontmatter stays the single source of truth,
 * so re-running is idempotent.
 *
 * Publishing (GraphQL — Discussions have no REST create endpoint):
 *   1. resolve the target repo's id, discussion categories and labels;
 *   2. map the item `type` via config/discussions.json — release →
 *      "Annoucements" (sic: the category name in the org repo is misspelled)
 *      + Released/Package; backlog-article → "Articles" + Article;
 *   3. if a discussion with the same title already exists, stamp only (heals
 *      a previous run that posted but died before stamping);
 *   4. createDiscussion, then addLabelsToLabelable;
 *   5. stamp `distributed_at` via the Contents API — the same direct-to-main
 *      commit the distribute Worker makes, so it triggers the usual planner
 *      rerun + Pages deploy.
 *
 * Auth: DISCUSSIONS_TOKEN — a fine-grained PAT with Discussions: read+write
 * and Issues: read (for labels) on the target repo, plus Contents: read+write
 * on this repo for the stamp commit.
 *
 *   pnpm publish-discussions --dry-run        # list what would be posted
 *   pnpm publish-discussions --date 2026-07-21
 *
 * Exits 0 when everything due was published (or nothing was due), 1 if any
 * item failed — the workflow run goes red and the item stays unused, so the
 * next run retries it.
 */
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import matter from 'gray-matter';
import {
	CALENDAR_DIR,
	type SlotType,
	type WeekSchedule,
} from '../lib/calendar.js';
import {setFrontmatterField} from '../lib/frontmatter.js';

const GITHUB_API = 'https://api.github.com';
const CONTENT_REPO_FALLBACK = 'Nano-Collective/contentforest';
const BOT_EMAIL = 'discussions-bot@nanocollective.org';

export type DuePost = {
	date: string;
	slot: string;
	type: SlotType;
	ref: string;
};

export type PostStatus = 'unused' | 'distributed' | 'wont_use' | 'missing';

export type ResolvedPost = {
	title: string;
	body: string;
	status: PostStatus;
};

export type DiscussionsConfig = {
	repo: string;
	mappings: Record<string, {category: string; labels: string[]}>;
};

export type RepoMeta = {
	id: string;
	categories: {id: string; name: string}[];
	labels: {id: string; name: string}[];
};

/**
 * Every github-discussion ledger item due on or before `today`, oldest first.
 * Purely positional — distribution status is checked later against the target
 * file, never the ledger.
 */
export function collectDue(root: string, today: string): DuePost[] {
	const dir = join(root, 'content', CALENDAR_DIR);
	if (!existsSync(dir)) return [];
	const due: DuePost[] = [];
	const seen = new Set<string>();
	for (const file of readdirSync(dir).sort()) {
		if (!file.endsWith('.json')) continue;
		let week: WeekSchedule;
		try {
			week = JSON.parse(readFileSync(join(dir, file), 'utf8')) as WeekSchedule;
		} catch {
			continue; // the validator owns ledger integrity; skip unparseable
		}
		const days = Object.entries(week.days ?? {}).sort(([a], [b]) =>
			a.localeCompare(b),
		);
		for (const [date, items] of days) {
			if (date > today) continue;
			for (const item of items ?? []) {
				if (item.channel !== 'github-discussion') continue;
				if (!item.ref || seen.has(item.ref)) continue;
				seen.add(item.ref);
				due.push({date, slot: item.slot, type: item.type, ref: item.ref});
			}
		}
	}
	return due;
}

/** Read a ref's content file and derive the discussion title/body + status. */
export function resolvePost(root: string, ref: string): ResolvedPost {
	const path = join(root, ref);
	if (!existsSync(path)) return {title: '', body: '', status: 'missing'};
	const {data, content} = matter(readFileSync(path, 'utf8'));
	const fm = data as Record<string, unknown>;
	const has = (v: unknown) => typeof v === 'string' && v.length > 0;
	const status: PostStatus = has(fm.distributed_at)
		? 'distributed'
		: has(fm.wont_use_at)
			? 'wont_use'
			: 'unused';
	return {...deriveTitleBody(fm, content, ref), status};
}

/**
 * Title comes from frontmatter (falling back to the body's leading H1, then
 * the ref). Generated files repeat the frontmatter title as a leading `# H1`;
 * a discussion renders its title above the body, so a matching H1 is dropped
 * to avoid showing it twice. A non-matching H1 is kept.
 */
export function deriveTitleBody(
	fm: Record<string, unknown>,
	content: string,
	ref: string,
): {title: string; body: string} {
	let body = content.trim();
	const h1 = body.match(/^#[ \t]+(.+)/);
	const fmTitle =
		typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : null;
	const title = fmTitle ?? h1?.[1].trim() ?? ref;
	if (h1 && h1[1].trim().toLowerCase() === title.toLowerCase()) {
		body = body.slice(h1[0].length).trim();
	}
	return {title, body};
}

export function loadConfig(root: string): DiscussionsConfig {
	const config = JSON.parse(
		readFileSync(join(root, 'config', 'discussions.json'), 'utf8'),
	) as DiscussionsConfig;
	if (typeof config.repo !== 'string' || !config.repo.includes('/'))
		throw new Error('config/discussions.json: "repo" must be "owner/name"');
	if (!config.mappings || typeof config.mappings !== 'object')
		throw new Error('config/discussions.json: missing "mappings"');
	return config;
}

/**
 * Resolve a slot type's configured category/label NAMES to node IDs from the
 * live repo. Throws with the available names when one doesn't exist, so a
 * renamed category/label in the org repo fails loudly instead of mis-filing.
 */
export function resolveMapping(
	type: string,
	config: DiscussionsConfig,
	meta: RepoMeta,
): {categoryId: string; labelIds: string[]} {
	const mapping = config.mappings[type];
	if (!mapping)
		throw new Error(
			`no discussions mapping for type "${type}" in config/discussions.json`,
		);
	const category = meta.categories.find(c => c.name === mapping.category);
	if (!category)
		throw new Error(
			`discussion category "${mapping.category}" not found in ${config.repo} (have: ${meta.categories.map(c => c.name).join(', ')})`,
		);
	const labelIds: string[] = [];
	for (const name of mapping.labels) {
		const label = meta.labels.find(l => l.name === name);
		if (!label)
			throw new Error(
				`label "${name}" not found in ${config.repo} (have: ${meta.labels.map(l => l.name).join(', ')})`,
			);
		labelIds.push(label.id);
	}
	return {categoryId: category.id, labelIds};
}

/** GitHub search query matching discussions in `repo` with `title` in-title. */
export function searchQueryFor(repo: string, title: string): string {
	return `repo:${repo} in:title ${JSON.stringify(title)}`;
}

// ── GitHub API + orchestration (network + process; exercised by the workflow) ─
/* c8 ignore start */

async function gql<T>(
	token: string,
	query: string,
	variables: Record<string, unknown>,
): Promise<T> {
	const res = await fetch(`${GITHUB_API}/graphql`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			'User-Agent': 'contentforest-publish-discussions',
		},
		body: JSON.stringify({query, variables}),
	});
	if (!res.ok)
		throw new Error(`GitHub GraphQL HTTP ${res.status}: ${await res.text()}`);
	const payload = (await res.json()) as {
		data?: T;
		errors?: {message: string}[];
	};
	if (payload.errors?.length)
		throw new Error(
			`GitHub GraphQL: ${payload.errors.map(e => e.message).join('; ')}`,
		);
	if (!payload.data) throw new Error('GitHub GraphQL: empty response');
	return payload.data;
}

async function fetchRepoMeta(token: string, repo: string): Promise<RepoMeta> {
	const [owner, name] = repo.split('/');
	const data = await gql<{
		repository: {
			id: string;
			hasDiscussionsEnabled: boolean;
			discussionCategories: {nodes: {id: string; name: string}[]};
			labels: {nodes: {id: string; name: string}[]};
		} | null;
	}>(
		token,
		`query($owner: String!, $name: String!) {
			repository(owner: $owner, name: $name) {
				id
				hasDiscussionsEnabled
				discussionCategories(first: 25) { nodes { id name } }
				labels(first: 100) { nodes { id name } }
			}
		}`,
		{owner, name},
	);
	if (!data.repository) throw new Error(`repository ${repo} not found`);
	if (!data.repository.hasDiscussionsEnabled)
		throw new Error(`${repo} does not have Discussions enabled`);
	return {
		id: data.repository.id,
		categories: data.repository.discussionCategories.nodes,
		labels: data.repository.labels.nodes,
	};
}

/** URL of an existing discussion with exactly this title, or null. */
async function findExistingDiscussion(
	token: string,
	repo: string,
	title: string,
): Promise<string | null> {
	const data = await gql<{
		search: {nodes: ({title?: string; url?: string} | null)[]};
	}>(
		token,
		`query($q: String!) {
			search(query: $q, type: DISCUSSION, first: 10) {
				nodes { ... on Discussion { title url } }
			}
		}`,
		{q: searchQueryFor(repo, title)},
	);
	const hit = data.search.nodes.find(n => n?.title === title);
	return hit?.url ?? null;
}

async function createDiscussion(
	token: string,
	repositoryId: string,
	categoryId: string,
	title: string,
	body: string,
): Promise<{id: string; url: string}> {
	const data = await gql<{
		createDiscussion: {discussion: {id: string; url: string}};
	}>(
		token,
		`mutation($input: CreateDiscussionInput!) {
			createDiscussion(input: $input) { discussion { id url } }
		}`,
		{input: {repositoryId, categoryId, title, body}},
	);
	return data.createDiscussion.discussion;
}

async function addLabels(
	token: string,
	labelableId: string,
	labelIds: string[],
): Promise<void> {
	await gql(
		token,
		`mutation($labelableId: ID!, $labelIds: [ID!]!) {
			addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
				clientMutationId
			}
		}`,
		{labelableId, labelIds},
	);
}

/**
 * Commit `distributed_at` into the ref's frontmatter on main via the Contents
 * API — same shape (and retry-on-409) as the distribute Worker, and the same
 * commit-message format so the git history reads uniformly.
 */
async function stampDistributed(
	token: string,
	contentRepo: string,
	ref: string,
	markedAt: string,
): Promise<void> {
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'User-Agent': 'contentforest-publish-discussions',
		'X-GitHub-Api-Version': '2022-11-28',
	};
	const url = `${GITHUB_API}/repos/${contentRepo}/contents/${ref}`;
	const MAX_ATTEMPTS = 4;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const getRes = await fetch(`${url}?ref=main`, {headers});
		if (!getRes.ok)
			throw new Error(
				`Contents GET ${ref} failed: HTTP ${getRes.status}: ${await getRes.text()}`,
			);
		const existing = (await getRes.json()) as {sha: string; content: string};
		const raw = Buffer.from(existing.content, 'base64').toString('utf8');
		const updated = setFrontmatterField(raw, 'distributed_at', markedAt);
		if (updated === raw) return;
		const author = {name: BOT_EMAIL.split('@')[0], email: BOT_EMAIL};
		const putRes = await fetch(url, {
			method: 'PUT',
			headers: {...headers, 'Content-Type': 'application/json'},
			body: JSON.stringify({
				message: `distribute: mark ${ref} distributed (by ${BOT_EMAIL})`,
				content: Buffer.from(updated, 'utf8').toString('base64'),
				branch: 'main',
				sha: existing.sha,
				author,
				committer: author,
			}),
		});
		if (putRes.ok) return;
		if (putRes.status === 409 && attempt < MAX_ATTEMPTS) continue;
		throw new Error(
			`Contents PUT ${ref} failed: HTTP ${putRes.status}: ${await putRes.text()}`,
		);
	}
}

type Args = {date: string; dryRun: boolean};

function parse(): Args {
	const {values} = parseArgs({
		options: {
			date: {type: 'string'},
			'dry-run': {type: 'boolean', default: false},
		},
	});
	return {
		date:
			(values.date as string | undefined) ??
			new Date().toISOString().slice(0, 10),
		dryRun: values['dry-run'] as boolean,
	};
}

async function main() {
	const args = parse();
	const root = process.cwd();
	const config = loadConfig(root);

	const pending: (DuePost & ResolvedPost)[] = [];
	for (const item of collectDue(root, args.date)) {
		const post = resolvePost(root, item.ref);
		if (post.status === 'missing') {
			console.warn(`  ⚠ skipping ${item.ref} — file missing (stale ledger?)`);
			continue;
		}
		if (post.status !== 'unused') continue;
		pending.push({...item, ...post});
	}
	console.log(
		`publish-discussions: ${args.date} — ${pending.length} due github-discussion post(s)`,
	);
	if (pending.length === 0) process.exit(0);

	if (args.dryRun) {
		for (const p of pending) {
			const mapping = config.mappings[p.type];
			console.log(
				`  [${p.date}] "${p.title}" → ${config.repo} category=${mapping?.category ?? '??'} labels=[${mapping?.labels.join(', ') ?? ''}] (${p.ref})`,
			);
		}
		console.log('\n--- DRY RUN: nothing posted, nothing stamped ---');
		process.exit(0);
	}

	const token = process.env.DISCUSSIONS_TOKEN;
	if (!token) throw new Error('DISCUSSIONS_TOKEN is not set');
	const contentRepo = process.env.GITHUB_REPOSITORY ?? CONTENT_REPO_FALLBACK;
	const meta = await fetchRepoMeta(token, config.repo);

	let failures = 0;
	for (const p of pending) {
		try {
			const {categoryId, labelIds} = resolveMapping(p.type, config, meta);
			const existing = await findExistingDiscussion(
				token,
				config.repo,
				p.title,
			);
			if (existing) {
				console.log(
					`  ↻ already posted, stamping only: "${p.title}" → ${existing}`,
				);
			} else {
				const discussion = await createDiscussion(
					token,
					meta.id,
					categoryId,
					p.title,
					p.body,
				);
				if (labelIds.length > 0)
					await addLabels(token, discussion.id, labelIds);
				console.log(`  ✓ published "${p.title}" → ${discussion.url}`);
			}
			await stampDistributed(
				token,
				contentRepo,
				p.ref,
				new Date().toISOString(),
			);
		} catch (err) {
			failures++;
			console.error(
				`  ✗ ${p.ref}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
	if (failures > 0) {
		console.error(
			`\npublish-discussions: ${failures} failure(s) — unstamped items retry on the next run`,
		);
		process.exit(1);
	}
	console.log(`\npublish-discussions: ✓ ${pending.length} post(s) handled`);
	process.exit(0);
}
/* c8 ignore stop */

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
