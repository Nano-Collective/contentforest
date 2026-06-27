/**
 * Orchestrates one weekly run that curates a "weekly content pack" from the
 * content already generated across the product and collective packs — the
 * stuff that is sitting unused (neither distributed nor marked won't-use) and
 * could still be posted. It is the once-a-week counterpart to x-daily, but it
 * GENERATES NOTHING NEW: it surfaces and recommends existing content.
 *
 * The Daily X posts (content/_x-daily/) are deliberately out of scope — they
 * have their own daily cadence. Personal/member-specific variants are excluded
 * too; this pack is about the shared, on-brand content.
 *
 * Shape of a run (the script owns the structure; the agent only judges):
 *   1. Gather candidates: every unused channel file across products + the
 *      collective, grouped by channel (github-discussion, reddit, linkedin, x).
 *   2. Selection agent (prompts/agents/weekly-pack-select.md): from the
 *      candidate catalogue, pick THE single most worth-resurfacing file per
 *      channel and a one-line reason. Retried until it parses + every channel
 *      that has candidates gets a valid pick, up to --max-retries.
 *   3. The script renders content/_weekly/<date>/digest.md (links + excerpt +
 *      rationale per pick, pointing back at the source files) and meta.json.
 *
 *   pnpm weekly-pack                         # today, writes to content/_local/
 *   pnpm weekly-pack --date 2026-06-29 --test
 *   pnpm weekly-pack --commit                # writes to content/ (the CI path)
 *   pnpm weekly-pack --dry-run               # print the select prompt, run nothing
 *
 * Exits 0 when a digest is written (or when there is genuinely nothing unused
 * to recommend — the workflow then skips opening a PR), 1 only on a hard
 * failure (e.g. the agent never produces a valid selection). Sister script to
 * x-daily.ts; structure is intentionally parallel for ease of comparison.
 */

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {
	type ContentFile,
	listCollectivePacks,
	listProducts,
	readCollectivePack,
	readVersionPack,
} from '../lib/content.js';

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');
const WEEKLY_DIR = '_weekly';
// Bound the per-channel catalogue handed to the agent so the prompt stays
// small even when a lot of content has piled up. Newest candidates win; the
// rest are logged as dropped (never silently truncated).
const MAX_CANDIDATES_PER_CHANNEL = 25;
// How many words of the body to show as a teaser, in the catalogue and digest.
const EXCERPT_WORDS = 40;

export type RunMode = 'commit' | 'local' | 'test';

export type Candidate = {
	channel: string;
	repoPath: string;
	sourceLabel: string;
	packPath: string;
	title: string | null;
	generatedAt: string;
	charCount: number;
	excerpt: string;
};

export type Pick = {
	channel: string;
	repoPath: string;
	why: string;
	candidate: Candidate;
};

const CHANNEL_LABELS: Record<string, string> = {
	'github-discussion': 'GitHub Discussion',
	reddit: 'Reddit',
	linkedin: 'LinkedIn',
	x: 'X',
};

// The article the user cares most about (the github discussion) leads; X
// trails. Unknown channels fall to the end in config order.
const CHANNEL_ORDER = ['github-discussion', 'reddit', 'linkedin', 'x'];

export function channelLabel(slug: string): string {
	return CHANNEL_LABELS[slug] ?? slug;
}

export function orderChannels(slugs: string[]): string[] {
	const rank = (s: string) => {
		const i = CHANNEL_ORDER.indexOf(s);
		return i < 0 ? CHANNEL_ORDER.length : i;
	};
	return [...slugs].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

type Args = {
	date: string;
	mode: RunMode;
	dryRun: boolean;
	maxAttempts: number;
};

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			date: {type: 'string'},
			commit: {type: 'boolean', default: false},
			test: {type: 'boolean', default: false},
			'dry-run': {type: 'boolean', default: false},
			'max-retries': {type: 'string', default: '3'},
		},
	});
	const mode: RunMode = values.commit
		? 'commit'
		: values.test
			? 'test'
			: 'local';
	return {
		date: (values.date as string | undefined) ?? todayIso(),
		mode,
		dryRun: values['dry-run'] as boolean,
		maxAttempts: Number.parseInt(values['max-retries'] as string, 10),
	};
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function readFile(path: string): string {
	return readFileSync(path, 'utf8');
}

function loadChannels(): string[] {
	const parsed = JSON.parse(readFile(join(CONFIG_DIR, 'channels.json'))) as {
		slug: string;
	}[];
	return parsed.map(c => c.slug);
}
/* c8 ignore stop */

export function substitute(
	template: string,
	vars: Record<string, string>,
): string {
	let out = template;
	for (const [key, value] of Object.entries(vars)) {
		out = out.replaceAll(`{{${key}}}`, value);
	}
	return out;
}

export function contentRootFor(mode: RunMode): string {
	switch (mode) {
		case 'commit':
			return 'content';
		case 'test':
			return 'content/_test';
		case 'local':
			return 'content/_local';
	}
}

/** True when a file is unused: no distributed_at AND no wont_use_at. */
export function isUnused(frontmatter: Record<string, unknown>): boolean {
	const has = (v: unknown) => typeof v === 'string' && v.length > 0;
	return !has(frontmatter.distributed_at) && !has(frontmatter.wont_use_at);
}

/**
 * Map a ContentFile channel key to its base channel slug, or null if it should
 * be excluded. The reader prefixes article files with `article:<slug>:` and
 * personal files with `personal:...`; weekly packs surface the shared base
 * content, so personal variants (member-specific, on-demand) are dropped.
 */
export function baseChannelOf(channel: string): string | null {
	let c = channel;
	if (c.startsWith('article:')) {
		const afterArticle = c.slice('article:'.length); // <slug>:<rest>
		const colon = afterArticle.indexOf(':');
		c = colon >= 0 ? afterArticle.slice(colon + 1) : '';
	}
	if (c === '' || c === 'personal' || c.startsWith('personal:')) return null;
	return c;
}

/** First N words of the body, collapsed to single spaces, with an ellipsis. */
export function excerptOf(
	body: string,
	maxWords: number = EXCERPT_WORDS,
): string {
	const words = body.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
	if (words.length === 0) return '';
	const slice = words.slice(0, maxWords).join(' ');
	return words.length > maxWords ? `${slice}…` : slice;
}

function candidateFromFile(
	file: ContentFile,
	sourceLabel: string,
	packPath: string,
): Candidate | null {
	const base = baseChannelOf(file.channel);
	if (!base) return null;
	if (!isUnused(file.frontmatter)) return null;
	// Empty placeholders (e.g. a channel that was scaffolded but never written)
	// are not worth recommending.
	if (file.body.trim().length === 0) return null;
	const title =
		typeof file.frontmatter.title === 'string' ? file.frontmatter.title : null;
	const generatedAt =
		typeof file.frontmatter.generated_at === 'string'
			? file.frontmatter.generated_at
			: '';
	const charCount =
		typeof file.frontmatter.char_count === 'number'
			? file.frontmatter.char_count
			: 0;
	return {
		channel: base,
		repoPath: file.repoPath,
		sourceLabel,
		packPath,
		title,
		generatedAt,
		charCount,
		excerpt: excerptOf(file.body),
	};
}

/**
 * Walk every product version and collective pack, collecting unused channel
 * files grouped by base channel. Excludes Daily X posts (never read here) and
 * personal variants (dropped by baseChannelOf). Each channel's list is sorted
 * newest-first. Channels with no candidates are present as empty arrays.
 */
export function gatherCandidates(
	contentDir: string,
	channels: string[],
): Map<string, Candidate[]> {
	const byChannel = new Map<string, Candidate[]>();
	for (const ch of channels) byChannel.set(ch, []);

	const add = (file: ContentFile, sourceLabel: string, packPath: string) => {
		const cand = candidateFromFile(file, sourceLabel, packPath);
		if (!cand) return;
		const list = byChannel.get(cand.channel);
		if (list) list.push(cand);
	};

	for (const product of listProducts(contentDir)) {
		for (const version of product.versions) {
			const pack = readVersionPack(product.slug, version, contentDir);
			for (const file of pack.files) {
				add(
					file,
					`${product.slug} v${version}`,
					`/p/${product.slug}/${version}`,
				);
			}
		}
	}

	for (const summary of listCollectivePacks(contentDir)) {
		const pack = readCollectivePack(summary.slug, contentDir);
		for (const file of pack.files) {
			add(file, `collective: ${summary.slug}`, `/c/${summary.slug}`);
		}
	}

	for (const list of byChannel.values()) {
		list.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
	}
	return byChannel;
}

/** A compact, agent-facing view of one candidate. */
function catalogueEntry(c: Candidate) {
	return {
		repoPath: c.repoPath,
		source: c.sourceLabel,
		title: c.title,
		generated_at: c.generatedAt,
		excerpt: c.excerpt,
	};
}

/**
 * Build the JSON catalogue for the agent: only channels that actually have
 * candidates, each capped to the newest MAX_CANDIDATES_PER_CHANNEL. Returns
 * the catalogue object plus how many were dropped per channel (for logging).
 */
export function buildCatalogue(
	byChannel: Map<string, Candidate[]>,
	channels: string[],
	cap: number = MAX_CANDIDATES_PER_CHANNEL,
): {
	catalogue: Record<string, ReturnType<typeof catalogueEntry>[]>;
	dropped: Record<string, number>;
} {
	const catalogue: Record<string, ReturnType<typeof catalogueEntry>[]> = {};
	const dropped: Record<string, number> = {};
	for (const channel of orderChannels(channels)) {
		const list = byChannel.get(channel) ?? [];
		if (list.length === 0) continue;
		catalogue[channel] = list.slice(0, cap).map(catalogueEntry);
		if (list.length > cap) dropped[channel] = list.length - cap;
	}
	return {catalogue, dropped};
}

/**
 * Parse the agent's selection. Must be a JSON object mapping each channel that
 * has candidates to {repoPath, why}, where repoPath is one of that channel's
 * candidates and why is a non-empty string. Returns Picks on success.
 */
export function parseSelection(
	raw: string,
	byChannel: Map<string, Candidate[]>,
	channels: string[],
): {ok: true; picks: Pick[]} | {ok: false; problems: string[]} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		return {
			ok: false,
			problems: [`selection file is not valid JSON: ${(e as Error).message}`],
		};
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return {ok: false, problems: ['selection must be a JSON object']};
	}
	const obj = parsed as Record<string, unknown>;
	const problems: string[] = [];
	const picks: Pick[] = [];

	// Only channels with candidates require a pick.
	const required = orderChannels(channels).filter(
		ch => (byChannel.get(ch) ?? []).length > 0,
	);

	for (const channel of required) {
		const entry = obj[channel];
		if (!entry || typeof entry !== 'object') {
			problems.push(`channel "${channel}": missing selection entry`);
			continue;
		}
		const {repoPath, why} = entry as Record<string, unknown>;
		if (typeof repoPath !== 'string' || repoPath.length === 0) {
			problems.push(
				`channel "${channel}": "repoPath" must be a non-empty string`,
			);
			continue;
		}
		if (typeof why !== 'string' || why.trim().length === 0) {
			problems.push(`channel "${channel}": "why" must be a non-empty string`);
		}
		const candidate = (byChannel.get(channel) ?? []).find(
			c => c.repoPath === repoPath,
		);
		if (!candidate) {
			problems.push(
				`channel "${channel}": repoPath "${repoPath}" is not one of the candidates`,
			);
			continue;
		}
		if (typeof why === 'string' && why.trim().length > 0) {
			picks.push({channel, repoPath, why: why.trim(), candidate});
		}
	}

	if (problems.length > 0) return {ok: false, problems};
	return {ok: true, picks};
}

/**
 * Render the digest markdown the script writes. The script owns this format;
 * the agent only chooses the picks and writes the `why`. Picks are ordered by
 * CHANNEL_ORDER; channels with no unused content are noted at the end.
 */
export function renderDigest(args: {
	date: string;
	picks: Pick[];
	emptyChannels: string[];
	generatedAt: string;
	model: string;
}): string {
	const ordered = orderChannels(args.picks.map(p => p.channel));
	const pickByChannel = new Map(args.picks.map(p => [p.channel, p]));

	const lines: string[] = [];
	lines.push('---');
	lines.push('kind: weekly');
	lines.push(`week_of: "${args.date}"`);
	lines.push(`generated_at: "${args.generatedAt}"`);
	lines.push(`model: "${args.model}"`);
	lines.push('---');
	lines.push('');
	lines.push(`# Weekly content pack — ${args.date}`);
	lines.push('');
	lines.push(
		"Unused content from across the packs (excludes Daily X posts), one recommended pick per channel. Mark a piece distributed or won't-use on its own pack page.",
	);
	lines.push('');

	for (const channel of ordered) {
		const pick = pickByChannel.get(channel);
		if (!pick) continue;
		const c = pick.candidate;
		lines.push(`## ${channelLabel(channel)}`);
		lines.push('');
		const titlePart = c.title ? ` — "${c.title}"` : '';
		lines.push(`**From:** ${c.sourceLabel}${titlePart}`);
		lines.push('');
		lines.push(`**Source:** \`${c.repoPath}\` · [open pack](${c.packPath})`);
		lines.push('');
		lines.push(`**Why this one:** ${pick.why}`);
		lines.push('');
		if (c.excerpt) {
			lines.push(`> ${c.excerpt}`);
			lines.push('');
		}
	}

	if (args.emptyChannels.length > 0) {
		const names = orderChannels(args.emptyChannels)
			.map(channelLabel)
			.join(', ');
		lines.push('---');
		lines.push('');
		lines.push(`_No unused content this week for: ${names}._`);
		lines.push('');
	}

	return `${lines.join('\n').trimEnd()}\n`;
}

export function buildSelectPrompt(args: {
	date: string;
	catalogueJson: string;
	channelsList: string;
	outputPath: string;
}): string {
	const template = readFile(
		join(PROMPTS_DIR, 'agents', 'weekly-pack-select.md'),
	);
	return substitute(template, {
		DATE: args.date,
		CATALOGUE_JSON: args.catalogueJson,
		CHANNELS_LIST: args.channelsList,
		OUTPUT_PATH: args.outputPath,
	});
}

/* c8 ignore start */
function runNanocoder(prompt: string, model: string): number {
	const result = spawnSync(
		'nanocoder',
		['run', prompt, '--mode', 'yolo', '--model', model, '--trust-directory'],
		{cwd: ROOT, stdio: 'inherit', env: process.env},
	);
	if (result.error) {
		if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
			console.error(
				'weekly-pack: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
			);
			return 127;
		}
		throw result.error;
	}
	return result.status ?? 1;
}

function writeMeta(args: {
	packDir: string;
	date: string;
	picks: Pick[];
	candidateCounts: Record<string, number>;
	generatedAt: string;
	model: string;
	finalStatus: 'passed' | 'empty';
}) {
	const meta = {
		kind: 'weekly',
		date: args.date,
		generated_at: args.generatedAt,
		model: args.model,
		picks: args.picks.map(p => ({
			channel: p.channel,
			repoPath: p.repoPath,
			source_label: p.candidate.sourceLabel,
			pack_path: p.candidate.packPath,
			title: p.candidate.title,
			why: p.why,
		})),
		candidate_counts: args.candidateCounts,
		final_status: args.finalStatus,
	};
	mkdirSync(args.packDir, {recursive: true});
	writeFileSync(join(args.packDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

async function main() {
	const args = parse();
	const channels = loadChannels();
	const contentRoot = contentRootFor(args.mode);
	const packDir = join(ROOT, contentRoot, WEEKLY_DIR, args.date);
	const generatedAt = new Date().toISOString();
	const model = 'minimax-m3';

	// Always gather from the canonical committed content — that is the corpus
	// of real, reviewable content regardless of where this run writes.
	const byChannel = gatherCandidates(join(ROOT, 'content'), channels);
	const candidateCounts: Record<string, number> = {};
	for (const ch of channels)
		candidateCounts[ch] = (byChannel.get(ch) ?? []).length;
	const totalCandidates = Object.values(candidateCounts).reduce(
		(a, b) => a + b,
		0,
	);

	console.log(
		`weekly-pack: ${args.date} (mode=${args.mode}) — candidates: ${orderChannels(
			channels,
		)
			.map(c => `${c}=${candidateCounts[c]}`)
			.join(', ')}`,
	);

	if (totalCandidates === 0) {
		console.log(
			'weekly-pack: nothing unused to recommend this week — writing no digest',
		);
		// Record the empty run so meta exists, but no digest is written; the
		// workflow keys off the missing digest.md to skip opening a PR.
		writeMeta({
			packDir,
			date: args.date,
			picks: [],
			candidateCounts,
			generatedAt,
			model,
			finalStatus: 'empty',
		});
		process.exit(0);
	}

	const {catalogue, dropped} = buildCatalogue(byChannel, channels);
	for (const [channel, n] of Object.entries(dropped)) {
		console.log(
			`weekly-pack: ${channel} has ${n} more unused candidate(s) beyond the cap of ${MAX_CANDIDATES_PER_CHANNEL}; showing newest only`,
		);
	}

	const channelsList = orderChannels(Object.keys(catalogue))
		.map(c => `- ${c} (${channelLabel(c)})`)
		.join('\n');
	const outputPath = join(tmpdir(), `cf-weekly-select-${Date.now()}.json`);
	const prompt = buildSelectPrompt({
		date: args.date,
		catalogueJson: JSON.stringify(catalogue, null, 2),
		channelsList,
		outputPath,
	});

	if (args.dryRun) {
		console.log(
			'\n--- DRY RUN: select prompt below, nanocoder NOT invoked ---\n',
		);
		console.log(prompt);
		process.exit(0);
	}

	// ── Selection agent, retried until it produces a valid pick set ──────────
	let picks: Pick[] | null = null;
	for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
		console.log(`\nweekly-pack: select attempt ${attempt}/${args.maxAttempts}`);
		const code = runNanocoder(prompt, model);
		if (code !== 0) {
			console.error(`weekly-pack: selector exited ${code}; aborting`);
			process.exit(code);
		}
		if (!existsSync(outputPath)) {
			console.error('weekly-pack: selector wrote no file; retrying');
			continue;
		}
		const result = parseSelection(
			readFileSync(outputPath, 'utf8'),
			byChannel,
			channels,
		);
		if (result.ok) {
			picks = result.picks;
			break;
		}
		console.error(
			`weekly-pack: selection invalid:\n  - ${result.problems.join('\n  - ')}`,
		);
	}
	if (!picks) {
		console.error('weekly-pack: could not get a valid selection; aborting');
		process.exit(1);
	}

	const pickedChannels = new Set(picks.map(p => p.channel));
	const emptyChannels = channels.filter(
		ch => !pickedChannels.has(ch) && candidateCounts[ch] === 0,
	);

	const digest = renderDigest({
		date: args.date,
		picks,
		emptyChannels,
		generatedAt,
		model,
	});
	mkdirSync(packDir, {recursive: true});
	writeFileSync(join(packDir, 'digest.md'), digest);
	writeMeta({
		packDir,
		date: args.date,
		picks,
		candidateCounts,
		generatedAt,
		model,
		finalStatus: 'passed',
	});

	console.log(
		`\nweekly-pack: ✓ wrote digest with ${picks.length} pick(s) → ${join(
			packDir,
			'digest.md',
		)}`,
	);
	process.exit(0);
}
/* c8 ignore stop */

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
