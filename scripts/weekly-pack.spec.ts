/**
 * Tests for the pure pieces of the weekly-pack orchestrator: channel helpers,
 * the unused/exclusion filters, candidate gathering against a temp content dir,
 * catalogue capping, selection parsing/validation, and digest rendering. The
 * I/O orchestration in main() (nanocoder spawns, file writes) is excluded from
 * coverage via c8 ignore and exercised end-to-end by the workflow.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	baseChannelOf,
	buildCatalogue,
	type Candidate,
	channelLabel,
	contentRootFor,
	deepLinkFor,
	excerptOf,
	gatherCandidates,
	isUnused,
	orderChannels,
	type Pick,
	parseSelection,
	renderDigest,
	substitute,
} from './weekly-pack.js';

const CHANNELS = ['linkedin', 'x', 'github-discussion', 'reddit'];

function makeTempContentDir(): string {
	return mkdtempSync(join(tmpdir(), 'cf-weekly-'));
}

function writeFile(path: string, body: string) {
	mkdirSync(join(path, '..'), {recursive: true});
	writeFileSync(path, body, 'utf8');
}

function channelFile(opts: {
	generatedAt: string;
	title?: string;
	distributedAt?: string;
	wontUseAt?: string;
	body?: string;
}): string {
	const lines = ['---', `generated_at: "${opts.generatedAt}"`];
	if (opts.title) lines.push(`title: "${opts.title}"`);
	if (opts.distributedAt) lines.push(`distributed_at: "${opts.distributedAt}"`);
	if (opts.wontUseAt) lines.push(`wont_use_at: "${opts.wontUseAt}"`);
	lines.push('---', '', opts.body ?? 'Some real body content here.');
	return lines.join('\n');
}

// ── small pure helpers ─────────────────────────────────────────────────────

test('substitute: replaces all occurrences of a key', t => {
	t.is(substitute('{{X}}-{{X}}', {X: 'a'}), 'a-a');
});

test('contentRootFor: maps each mode to its content root', t => {
	t.is(contentRootFor('commit'), 'content');
	t.is(contentRootFor('test'), 'content/_test');
	t.is(contentRootFor('local'), 'content/_local');
});

test('channelLabel: known channels get pretty labels, unknown pass through', t => {
	t.is(channelLabel('github-discussion'), 'GitHub Discussion');
	t.is(channelLabel('x'), 'X');
	t.is(channelLabel('mastodon'), 'mastodon');
});

test('orderChannels: github-discussion leads, x trails, unknowns last', t => {
	t.deepEqual(orderChannels(['x', 'reddit', 'github-discussion', 'linkedin']), [
		'github-discussion',
		'reddit',
		'linkedin',
		'x',
	]);
	t.deepEqual(orderChannels(['mastodon', 'x']), ['x', 'mastodon']);
});

test('isUnused: true only when neither distributed nor wont-use is set', t => {
	t.true(isUnused({}));
	t.true(isUnused({distributed_at: ''}));
	t.false(isUnused({distributed_at: '2026-06-25T00:00:00.000Z'}));
	t.false(isUnused({wont_use_at: '2026-06-25T00:00:00.000Z'}));
});

test('baseChannelOf: strips article prefix and drops personal variants', t => {
	t.is(baseChannelOf('reddit'), 'reddit');
	t.is(baseChannelOf('article:my-slug:github-discussion'), 'github-discussion');
	t.is(baseChannelOf('personal:ben-parry:linkedin'), null);
	t.is(baseChannelOf('article:my-slug:personal:ben:linkedin'), null);
});

test('excerptOf: collapses whitespace and caps word count with an ellipsis', t => {
	t.is(excerptOf('one  two\nthree', 5), 'one two three');
	t.is(excerptOf('a b c d e f', 3), 'a b c…');
	t.is(excerptOf('   ', 5), '');
});

// ── gatherCandidates ────────────────────────────────────────────────────────

test('gatherCandidates: collects unused product + collective channel files', t => {
	const tmp = makeTempContentDir();
	// product channel (unused)
	writeFile(
		join(tmp, 'nanocoder', '1.0.0', 'channels', 'reddit.md'),
		channelFile({generatedAt: '2026-06-01T00:00:00.000Z'}),
	);
	// product article channel (unused, newer)
	writeFile(
		join(
			tmp,
			'nanocoder',
			'1.0.0',
			'articles',
			'deep',
			'channels',
			'github-discussion.md',
		),
		channelFile({generatedAt: '2026-06-10T00:00:00.000Z', title: 'Deep dive'}),
	);
	// collective channel (unused)
	writeFile(
		join(tmp, '_collective', 'launch', 'channels', 'linkedin.md'),
		channelFile({generatedAt: '2026-06-05T00:00:00.000Z'}),
	);
	const byChannel = gatherCandidates(tmp, CHANNELS);
	t.is(byChannel.get('reddit')?.length, 1);
	t.is(byChannel.get('github-discussion')?.length, 1);
	t.is(byChannel.get('linkedin')?.length, 1);
	t.is(byChannel.get('x')?.length, 0);
	const gh = byChannel.get('github-discussion')?.[0] as Candidate;
	t.is(gh.title, 'Deep dive');
	t.is(gh.sourceLabel, 'nanocoder v1.0.0');
	t.is(gh.packPath, '/p/nanocoder/1.0.0');
	t.is(gh.channelKey, 'article:deep:github-discussion');
	t.true(gh.isArticle);
	const li = byChannel.get('linkedin')?.[0] as Candidate;
	t.is(li.channelKey, 'linkedin');
	t.false(li.isArticle);
	rmSync(tmp, {recursive: true});
});

test('gatherCandidates: excludes distributed, wont-use, personal and empty files', t => {
	const tmp = makeTempContentDir();
	writeFile(
		join(tmp, 'nanocoder', '1.0.0', 'channels', 'reddit.md'),
		channelFile({
			generatedAt: '2026-06-01T00:00:00.000Z',
			distributedAt: '2026-06-02T00:00:00.000Z',
		}),
	);
	writeFile(
		join(tmp, 'nanocoder', '1.0.0', 'channels', 'linkedin.md'),
		channelFile({
			generatedAt: '2026-06-01T00:00:00.000Z',
			wontUseAt: '2026-06-02T00:00:00.000Z',
		}),
	);
	writeFile(
		join(tmp, 'nanocoder', '1.0.0', 'channels', 'x.md'),
		channelFile({generatedAt: '2026-06-01T00:00:00.000Z', body: '   '}),
	);
	writeFile(
		join(tmp, '_collective', 'launch', 'personal', 'ben-parry', 'linkedin.md'),
		channelFile({generatedAt: '2026-06-01T00:00:00.000Z'}),
	);
	const byChannel = gatherCandidates(tmp, CHANNELS);
	for (const ch of CHANNELS) t.is(byChannel.get(ch)?.length, 0, ch);
	rmSync(tmp, {recursive: true});
});

test('gatherCandidates: sorts each channel newest-first', t => {
	const tmp = makeTempContentDir();
	writeFile(
		join(tmp, 'nanocoder', '1.0.0', 'channels', 'reddit.md'),
		channelFile({generatedAt: '2026-06-01T00:00:00.000Z', body: 'older'}),
	);
	writeFile(
		join(tmp, 'nanocoder', '2.0.0', 'channels', 'reddit.md'),
		channelFile({generatedAt: '2026-06-09T00:00:00.000Z', body: 'newer'}),
	);
	const reddit = gatherCandidates(tmp, CHANNELS).get('reddit') as Candidate[];
	t.is(reddit[0].generatedAt, '2026-06-09T00:00:00.000Z');
	t.is(reddit[1].generatedAt, '2026-06-01T00:00:00.000Z');
	rmSync(tmp, {recursive: true});
});

// ── buildCatalogue ──────────────────────────────────────────────────────────

function fakeCandidate(channel: string, i: number): Candidate {
	return {
		channel,
		channelKey: channel,
		repoPath: `content/p/${channel}-${i}.md`,
		sourceLabel: `src ${i}`,
		packPath: `/p/x/${i}`,
		title: null,
		generatedAt: `2026-06-${String(i).padStart(2, '0')}T00:00:00.000Z`,
		charCount: 100,
		excerpt: `excerpt ${i}`,
		isArticle: false,
	};
}

test('buildCatalogue: omits empty channels and caps to the newest N', t => {
	const byChannel = new Map<string, Candidate[]>();
	byChannel.set(
		'reddit',
		Array.from({length: 5}, (_, i) => fakeCandidate('reddit', i + 1)),
	);
	byChannel.set('x', []);
	const {catalogue, dropped} = buildCatalogue(byChannel, ['reddit', 'x'], 3);
	t.deepEqual(Object.keys(catalogue), ['reddit']);
	t.is(catalogue.reddit.length, 3);
	t.is(dropped.reddit, 2);
	t.false('x' in catalogue);
	t.false('x' in dropped);
});

// ── parseSelection ──────────────────────────────────────────────────────────

function candidatesWith(...channels: string[]): Map<string, Candidate[]> {
	const m = new Map<string, Candidate[]>();
	for (const ch of CHANNELS) m.set(ch, []);
	for (const ch of channels) m.set(ch, [fakeCandidate(ch, 1)]);
	return m;
}

test('parseSelection: accepts a valid pick for every channel with candidates', t => {
	const byChannel = candidatesWith('reddit', 'github-discussion');
	const raw = JSON.stringify({
		reddit: {repoPath: 'content/p/reddit-1.md', why: 'punchy and fresh'},
		'github-discussion': {
			repoPath: 'content/p/github-discussion-1.md',
			why: 'meaty deep dive',
		},
	});
	const result = parseSelection(raw, byChannel, CHANNELS);
	t.true(result.ok);
	if (result.ok) {
		t.is(result.picks.length, 2);
		t.is(
			result.picks.find(p => p.channel === 'reddit')?.why,
			'punchy and fresh',
		);
	}
});

test('parseSelection: rejects non-object JSON', t => {
	const result = parseSelection('[1,2]', candidatesWith('reddit'), CHANNELS);
	t.false(result.ok);
});

test('parseSelection: rejects a repoPath not among the channel candidates', t => {
	const byChannel = candidatesWith('reddit');
	const raw = JSON.stringify({
		reddit: {repoPath: 'content/p/bogus.md', why: 'nope'},
	});
	const result = parseSelection(raw, byChannel, CHANNELS);
	t.false(result.ok);
	if (!result.ok) t.true(result.problems.some(p => p.includes('not one of')));
});

test('parseSelection: rejects a missing channel that has candidates', t => {
	const byChannel = candidatesWith('reddit', 'x');
	const raw = JSON.stringify({
		reddit: {repoPath: 'content/p/reddit-1.md', why: 'ok'},
	});
	const result = parseSelection(raw, byChannel, CHANNELS);
	t.false(result.ok);
	if (!result.ok) t.true(result.problems.some(p => p.includes('missing')));
});

test('parseSelection: rejects an empty why', t => {
	const byChannel = candidatesWith('reddit');
	const raw = JSON.stringify({
		reddit: {repoPath: 'content/p/reddit-1.md', why: '   '},
	});
	const result = parseSelection(raw, byChannel, CHANNELS);
	t.false(result.ok);
});

// ── renderDigest ────────────────────────────────────────────────────────────

function fakePick(channel: string, opts: {isArticle?: boolean} = {}): Pick {
	const candidate = fakeCandidate(channel, 1);
	candidate.title = `${channel} title`;
	candidate.excerpt = `${channel} excerpt`;
	candidate.channelKey = opts.isArticle ? `article:slug:${channel}` : channel;
	candidate.isArticle = !!opts.isArticle;
	return {
		channel,
		repoPath: candidate.repoPath,
		why: `why ${channel}`,
		candidate,
	};
}

test('deepLinkFor: deep-links to the exact file via an encoded ?file= param', t => {
	const c = fakeCandidate('github-discussion', 1);
	c.packPath = '/p/nanocoder/1.28.0';
	c.channelKey = 'article:acp:github-discussion';
	t.is(
		deepLinkFor(c),
		'/p/nanocoder/1.28.0?file=article%3Aacp%3Agithub-discussion',
	);
});

test('renderDigest: orders picks, embeds title/why/excerpt/deep-link, lists empty channels', t => {
	const digest = renderDigest({
		date: '2026-06-29',
		picks: [fakePick('x'), fakePick('github-discussion', {isArticle: true})],
		emptyChannels: ['linkedin', 'reddit'],
		generatedAt: '2026-06-29T00:15:00.000Z',
		model: 'minimax-m3',
	});
	// frontmatter
	t.true(digest.startsWith('---\nkind: weekly\n'));
	t.true(digest.includes('week_of: "2026-06-29"'));
	// github-discussion section comes before X (heading now includes the title)
	t.true(
		digest.indexOf('## GitHub Discussion — github-discussion title') <
			digest.indexOf('## X — x title'),
	);
	// per-pick content
	t.true(digest.includes('**Why this one:** why github-discussion'));
	t.true(digest.includes('**What:** Deep-dive article from src 1'));
	t.true(digest.includes('**What:** Release / announcement post from src 1'));
	// prominent deep link to the exact file, opening on its pack page
	t.true(
		digest.includes(
			'[**Open this post**](/p/x/1?file=article%3Aslug%3Agithub-discussion)',
		),
	);
	// source path kept as small secondary reference
	t.true(digest.includes('<sub>Source file: `content/p/x-1.md`</sub>'));
	t.true(digest.includes('> x excerpt'));
	// empty channels noted, ordered
	t.true(digest.includes('No unused content this week for: Reddit, LinkedIn.'));
	t.true(digest.endsWith('\n'));
});
