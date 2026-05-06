import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	buildTargetOptionsBlock,
	listTargetOptions,
	rewrite,
	type TargetOption,
} from './sync-change-targets.js';

function writeMeta(dir: string, generatedAt?: string) {
	if (!generatedAt) return;
	writeFileSync(
		join(dir, 'meta.json'),
		JSON.stringify({generated_at: generatedAt}),
	);
}

function makeContent(spec: {
	products?: Record<
		string,
		Record<string, {generatedAt?: string; articles?: string[]}>
	>;
	collective?: Record<string, string | undefined>;
	skipDirs?: string[];
}): string {
	const root = mkdtempSync(join(tmpdir(), 'cf-sync-change-targets-'));
	for (const [product, versions] of Object.entries(spec.products ?? {})) {
		for (const [version, v] of Object.entries(versions)) {
			const dir = join(root, product, version);
			mkdirSync(dir, {recursive: true});
			writeMeta(dir, v.generatedAt);
			for (const articleSlug of v.articles ?? []) {
				mkdirSync(join(dir, 'articles', articleSlug), {recursive: true});
			}
		}
	}
	if (spec.collective) {
		const collectiveRoot = join(root, '_collective');
		mkdirSync(collectiveRoot, {recursive: true});
		for (const [slug, generatedAt] of Object.entries(spec.collective)) {
			const dir = join(collectiveRoot, slug);
			mkdirSync(dir, {recursive: true});
			writeMeta(dir, generatedAt);
		}
	}
	for (const dir of spec.skipDirs ?? []) {
		mkdirSync(join(root, dir), {recursive: true});
	}
	return root;
}

test('listTargetOptions: includes packs and their articles', t => {
	const root = makeContent({
		products: {
			nanocoder: {
				'1.25.0': {
					generatedAt: '2026-04-01T00:00:00Z',
					articles: ['mcp-support', 'logger-rewrite'],
				},
			},
		},
	});
	const options = listTargetOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		[
			'nanocoder/1.25.0',
			'nanocoder/1.25.0/articles/logger-rewrite',
			'nanocoder/1.25.0/articles/mcp-support',
		],
	);
});

test('listTargetOptions: excludes collective packs', t => {
	const root = makeContent({
		products: {nanocoder: {'1.25.0': {generatedAt: '2026-04-01T00:00:00Z'}}},
		collective: {'contentforest-launch': '2026-03-01T00:00:00Z'},
	});
	const options = listTargetOptions(root);
	t.true(options.every(o => !o.value.startsWith('_collective/')));
});

test('listTargetOptions: skips other underscore-prefixed top-level dirs', t => {
	const root = makeContent({
		products: {nanocoder: {'1.25.0': {generatedAt: '2026-04-01T00:00:00Z'}}},
		skipDirs: ['_test', '_scratch'],
	});
	const options = listTargetOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		['nanocoder/1.25.0'],
	);
});

test('listTargetOptions: sorts newest-first; pack appears before its articles', t => {
	const root = makeContent({
		products: {
			nanocoder: {
				'1.25.0': {
					generatedAt: '2026-04-01T00:00:00Z',
					articles: ['mcp-support'],
				},
				'1.20.0': {
					generatedAt: '2026-01-01T00:00:00Z',
					articles: ['old-feature'],
				},
			},
		},
	});
	const options = listTargetOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		[
			'nanocoder/1.25.0',
			'nanocoder/1.25.0/articles/mcp-support',
			'nanocoder/1.20.0',
			'nanocoder/1.20.0/articles/old-feature',
		],
	);
});

test('listTargetOptions: returns [] when content/ does not exist', t => {
	t.deepEqual(listTargetOptions('/nonexistent/path'), []);
});

test('buildTargetOptionsBlock: renders dropdown with both packs and articles', t => {
	const block = buildTargetOptionsBlock([
		{value: 'nanocoder/1.25.0', generatedAt: '2026-04-01T00:00:00Z'},
		{
			value: 'nanocoder/1.25.0/articles/mcp-support',
			generatedAt: '2026-04-01T00:00:00Z',
		},
	]);
	t.true(block.includes('  - type: dropdown'));
	t.true(block.includes('        - nanocoder/1.25.0'));
	t.true(block.includes('        - nanocoder/1.25.0/articles/mcp-support'));
	t.true(block.startsWith('  # BEGIN AUTO-TARGETS'));
	t.true(block.endsWith('  # END AUTO-TARGETS'));
});

test('buildTargetOptionsBlock: falls back to free-text input when no targets', t => {
	const block = buildTargetOptionsBlock([]);
	t.true(block.includes('  - type: input'));
	t.true(block.includes('No product release packs exist yet'));
});

test('rewrite: swaps the bracketed block in place', t => {
	const before = [
		'name: example',
		'body:',
		'  - type: markdown',
		'    attributes:',
		'      value: header',
		'  # BEGIN AUTO-TARGETS — old marker text',
		'  - type: input',
		'    id: target',
		'  # END AUTO-TARGETS',
		'  - type: textarea',
		'    id: request',
		'',
	].join('\n');
	const after = rewrite(before, [
		{value: 'nanocoder/1.25.0', generatedAt: '2026-04-01T00:00:00Z'},
	]);
	t.true(after.includes('  - type: dropdown'));
	t.true(after.includes('        - nanocoder/1.25.0'));
	t.true(after.includes('  - type: textarea'));
});

test('rewrite: throws when markers are missing', t => {
	t.throws(() => rewrite('no markers', [] as TargetOption[]), {
		message: /missing AUTO-TARGETS markers/,
	});
});
