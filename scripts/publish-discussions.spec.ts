/**
 * Tests for the pure pieces of the discussions publisher: due-item collection
 * from ledgers, post resolution (status + title/body derivation), config
 * loading, category/label name → id mapping, and the duplicate-title search
 * query. The GitHub API calls and main() orchestration are excluded from
 * coverage via c8 ignore and exercised end-to-end by the workflow.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	collectDue,
	type DiscussionsConfig,
	deriveTitleBody,
	loadConfig,
	type RepoMeta,
	resolveMapping,
	resolvePost,
	searchQueryFor,
} from './publish-discussions.js';

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'publish-discussions-'));
	mkdirSync(join(root, 'content', '_calendar'), {recursive: true});
	return root;
}

function writeLedger(
	root: string,
	weekOf: string,
	days: Record<string, unknown[]>,
): void {
	writeFileSync(
		join(root, 'content', '_calendar', `${weekOf}.json`),
		JSON.stringify({week_of: weekOf, generated_at: 'x', days}),
	);
}

const DISCUSSION_ITEM = (ref: string, date: string, type = 'release') => ({
	slot: 'github-discussion-1',
	channel: 'github-discussion',
	type,
	ref,
	date,
});

test('collectDue: picks github-discussion items due today or earlier, skips future and other channels', t => {
	const root = makeRoot();
	try {
		writeLedger(root, '2026-07-13', {
			'2026-07-15': [
				{
					slot: 'github-discussion-1',
					channel: 'github-discussion',
					type: 'release',
					ref: 'content/a/1.0.0/channels/github-discussion.md',
				},
				{slot: 'x-1', channel: 'x', type: 'evergreen-x', ref: 'content/x.md'},
			],
		});
		writeLedger(root, '2026-07-20', {
			'2026-07-21': [
				{
					slot: 'github-discussion-1',
					channel: 'github-discussion',
					type: 'backlog-article',
					ref: 'content/b/articles/deep/channels/github-discussion.md',
				},
			],
			'2026-07-24': [
				{
					slot: 'github-discussion-1',
					channel: 'github-discussion',
					type: 'backlog-article',
					ref: 'content/c/articles/later/channels/github-discussion.md',
				},
			],
		});
		const due = collectDue(root, '2026-07-21');
		t.deepEqual(
			due.map(d => [d.date, d.ref, d.type]),
			[
				[
					'2026-07-15',
					'content/a/1.0.0/channels/github-discussion.md',
					'release',
				],
				[
					'2026-07-21',
					'content/b/articles/deep/channels/github-discussion.md',
					'backlog-article',
				],
			],
		);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('collectDue: dedupes a ref that appears in more than one ledger day', t => {
	const root = makeRoot();
	try {
		const ref = 'content/a/1.0.0/channels/github-discussion.md';
		writeLedger(root, '2026-07-13', {
			'2026-07-14': [DISCUSSION_ITEM(ref, '2026-07-14')],
			'2026-07-16': [DISCUSSION_ITEM(ref, '2026-07-16')],
		});
		t.is(collectDue(root, '2026-07-21').length, 1);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('collectDue: tolerates a missing calendar dir and an unparseable ledger', t => {
	const empty = mkdtempSync(join(tmpdir(), 'publish-discussions-'));
	try {
		t.deepEqual(collectDue(empty, '2026-07-21'), []);
	} finally {
		rmSync(empty, {recursive: true, force: true});
	}
	const root = makeRoot();
	try {
		writeFileSync(
			join(root, 'content', '_calendar', '2026-07-13.json'),
			'not json',
		);
		t.deepEqual(collectDue(root, '2026-07-21'), []);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('resolvePost: reads status and strips the H1 that repeats the title', t => {
	const root = makeRoot();
	try {
		const dir = join(root, 'content', 'a', '1.0.0', 'channels');
		mkdirSync(dir, {recursive: true});
		writeFileSync(
			join(dir, 'github-discussion.md'),
			'---\ntitle: "Hello v1"\nchannel: github-discussion\n---\n\n# Hello v1\n\nBody text.\n',
		);
		const post = resolvePost(
			root,
			'content/a/1.0.0/channels/github-discussion.md',
		);
		t.is(post.status, 'unused');
		t.is(post.title, 'Hello v1');
		t.is(post.body, 'Body text.');
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('resolvePost: distributed / wont_use / missing statuses', t => {
	const root = makeRoot();
	try {
		const dir = join(root, 'content', 'a');
		mkdirSync(dir, {recursive: true});
		writeFileSync(
			join(dir, 'done.md'),
			'---\ntitle: "Done"\ndistributed_at: "2026-07-15T09:40:35.674Z"\n---\nx\n',
		);
		writeFileSync(
			join(dir, 'skip.md'),
			'---\ntitle: "Skip"\nwont_use_at: "2026-07-15T09:40:35.674Z"\n---\nx\n',
		);
		t.is(resolvePost(root, 'content/a/done.md').status, 'distributed');
		t.is(resolvePost(root, 'content/a/skip.md').status, 'wont_use');
		t.is(resolvePost(root, 'content/a/nope.md').status, 'missing');
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('deriveTitleBody: keeps an H1 that differs from the frontmatter title', t => {
	const {title, body} = deriveTitleBody(
		{title: 'Outer title'},
		'# Different heading\n\nBody.',
		'content/a.md',
	);
	t.is(title, 'Outer title');
	t.is(body, '# Different heading\n\nBody.');
});

test('deriveTitleBody: falls back to the H1, then the ref, when no frontmatter title', t => {
	const fromH1 = deriveTitleBody({}, '# From H1\n\nBody.', 'content/a.md');
	t.is(fromH1.title, 'From H1');
	t.is(fromH1.body, 'Body.');
	const fromRef = deriveTitleBody({}, 'Just body.', 'content/a.md');
	t.is(fromRef.title, 'content/a.md');
	t.is(fromRef.body, 'Just body.');
});

const META: RepoMeta = {
	id: 'R_1',
	categories: [
		{id: 'C_ann', name: 'Annoucements'},
		{id: 'C_art', name: 'Articles'},
	],
	labels: [
		{id: 'L_rel', name: 'Released'},
		{id: 'L_pkg', name: 'Package'},
		{id: 'L_art', name: 'Article'},
	],
};

const CONFIG: DiscussionsConfig = {
	repo: 'Nano-Collective/organisation',
	mappings: {
		release: {category: 'Annoucements', labels: ['Released', 'Package']},
		'backlog-article': {category: 'Articles', labels: ['Article']},
	},
};

test('resolveMapping: maps type → category/label ids', t => {
	t.deepEqual(resolveMapping('release', CONFIG, META), {
		categoryId: 'C_ann',
		labelIds: ['L_rel', 'L_pkg'],
	});
	t.deepEqual(resolveMapping('backlog-article', CONFIG, META), {
		categoryId: 'C_art',
		labelIds: ['L_art'],
	});
});

test('resolveMapping: throws on unknown type, missing category, missing label', t => {
	t.throws(() => resolveMapping('evergreen-x', CONFIG, META), {
		message: /no discussions mapping/,
	});
	t.throws(() => resolveMapping('release', CONFIG, {...META, categories: []}), {
		message: /category "Annoucements" not found/,
	});
	t.throws(() => resolveMapping('release', CONFIG, {...META, labels: []}), {
		message: /label "Released" not found/,
	});
});

test('loadConfig: the committed config parses and covers both schedulable types', t => {
	const config = loadConfig(process.cwd());
	t.is(config.repo, 'Nano-Collective/organisation');
	t.truthy(config.mappings.release);
	t.truthy(config.mappings['backlog-article']);
});

test('loadConfig: rejects a malformed config', t => {
	const root = makeRoot();
	try {
		mkdirSync(join(root, 'config'), {recursive: true});
		writeFileSync(join(root, 'config', 'discussions.json'), '{"repo": "nope"}');
		t.throws(() => loadConfig(root), {message: /"repo" must be/});
		writeFileSync(join(root, 'config', 'discussions.json'), '{"repo": "a/b"}');
		t.throws(() => loadConfig(root), {message: /missing "mappings"/});
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('searchQueryFor: quotes the title so exact-phrase search works', t => {
	t.is(
		searchQueryFor('a/b', 'Hello "v1"'),
		'repo:a/b in:title "Hello \\"v1\\""',
	);
});
