import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	buildPackOptionsBlock,
	listPackOptions,
	type PackOption,
	rewrite,
} from './sync-pack-options.js';

function writeMeta(dir: string, generatedAt?: string) {
	if (!generatedAt) return;
	writeFileSync(
		join(dir, 'meta.json'),
		JSON.stringify({generated_at: generatedAt}),
	);
}

function makeContent(spec: {
	products?: Record<string, Record<string, string | undefined>>;
	collective?: Record<string, string | undefined>;
	skipDirs?: string[];
}): string {
	const root = mkdtempSync(join(tmpdir(), 'cf-sync-pack-options-'));
	for (const [product, versions] of Object.entries(spec.products ?? {})) {
		for (const [version, generatedAt] of Object.entries(versions)) {
			const dir = join(root, product, version);
			mkdirSync(dir, {recursive: true});
			writeMeta(dir, generatedAt);
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

test('listPackOptions: lists product and collective packs', t => {
	const root = makeContent({
		products: {nanocoder: {'1.25.0': '2026-04-01T00:00:00Z'}},
		collective: {'contentforest-launch': '2026-03-01T00:00:00Z'},
	});
	const options = listPackOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		['nanocoder/1.25.0', '_collective/contentforest-launch'],
	);
});

test('listPackOptions: sorts newest-first by generated_at', t => {
	const root = makeContent({
		products: {
			nanocoder: {
				'1.20.0': '2026-01-01T00:00:00Z',
				'1.25.0': '2026-04-01T00:00:00Z',
				'1.22.0': '2026-02-01T00:00:00Z',
			},
		},
	});
	const options = listPackOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		['nanocoder/1.25.0', 'nanocoder/1.22.0', 'nanocoder/1.20.0'],
	);
});

test('listPackOptions: falls back to value-sorted descending when generated_at missing', t => {
	const root = makeContent({
		products: {
			nanocoder: {
				'1.20.0': undefined,
				'1.25.0': undefined,
			},
		},
	});
	const options = listPackOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		['nanocoder/1.25.0', 'nanocoder/1.20.0'],
	);
});

test('listPackOptions: packs with generated_at float above packs without', t => {
	const root = makeContent({
		products: {
			nanocoder: {
				'0.0.0': undefined,
				'1.25.0': '2026-04-01T00:00:00Z',
			},
		},
	});
	const options = listPackOptions(root);
	t.is(options[0].value, 'nanocoder/1.25.0');
});

test('listPackOptions: skips underscore-prefixed top-level dirs except _collective', t => {
	const root = makeContent({
		products: {nanocoder: {'1.25.0': '2026-04-01T00:00:00Z'}},
		skipDirs: ['_test', '_scratch'],
	});
	const options = listPackOptions(root);
	t.deepEqual(
		options.map(o => o.value),
		['nanocoder/1.25.0'],
	);
});

test('listPackOptions: returns [] when content/ does not exist', t => {
	t.deepEqual(listPackOptions('/nonexistent/path'), []);
});

test('buildPackOptionsBlock: renders dropdown when options exist', t => {
	const block = buildPackOptionsBlock([
		{value: 'nanocoder/1.25.0', generatedAt: '2026-04-01T00:00:00Z'},
		{value: '_collective/launch', generatedAt: '2026-03-01T00:00:00Z'},
	]);
	t.true(block.includes('  - type: dropdown'));
	t.true(block.includes('        - nanocoder/1.25.0'));
	t.true(block.includes('        - _collective/launch'));
	t.true(block.startsWith('  # BEGIN AUTO-PACKS'));
	t.true(block.endsWith('  # END AUTO-PACKS'));
});

test('buildPackOptionsBlock: falls back to free-text input when no packs', t => {
	const block = buildPackOptionsBlock([]);
	t.true(block.includes('  - type: input'));
	t.true(block.includes('No packs exist yet'));
});

test('rewrite: swaps the bracketed block in place', t => {
	const before = [
		'name: example',
		'body:',
		'  - type: markdown',
		'    attributes:',
		'      value: header',
		'  # BEGIN AUTO-PACKS — old marker text',
		'  - type: input',
		'    id: base_pack',
		'  # END AUTO-PACKS',
		'  - type: textarea',
		'    id: context',
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
	t.throws(() => rewrite('no markers', [] as PackOption[]), {
		message: /missing AUTO-PACKS markers/,
	});
});

test('listPackOptions: caps at 50 packs', t => {
	const versions: Record<string, string> = {};
	for (let i = 0; i < 60; i++) {
		// pad to fixed width so lexicographic sort agrees with intent
		versions[`1.${String(i).padStart(2, '0')}.0`] =
			`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`;
	}
	const root = makeContent({products: {demo: versions}});
	const options = listPackOptions(root);
	t.is(options.length, 50);
});
