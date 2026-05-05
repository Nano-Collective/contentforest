import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {buildSlugBlock, listSlugs, rewrite} from './sync-collective-slugs.js';

function makeCollectiveDir(slugs: string[]): string {
	const root = mkdtempSync(join(tmpdir(), 'cf-sync-slugs-'));
	for (const slug of slugs) {
		mkdirSync(join(root, slug), {recursive: true});
	}
	// Stray file should be ignored — only directories count as packs.
	writeFileSync(join(root, 'README.md'), 'noise');
	return root;
}

test('listSlugs returns sorted directory names only', t => {
	const dir = makeCollectiveDir(['zeta-pack', 'alpha-pack', 'mu-pack']);
	t.deepEqual(listSlugs(dir), ['alpha-pack', 'mu-pack', 'zeta-pack']);
});

test('listSlugs returns [] when the directory does not exist', t => {
	t.deepEqual(listSlugs('/nonexistent/path/that/should/not/be/there'), []);
});

test('buildSlugBlock renders a dropdown when there are slugs', t => {
	const block = buildSlugBlock(['contentforest-launch', 'governance-update']);
	t.true(block.includes('  - type: dropdown'));
	t.true(block.includes('        - contentforest-launch'));
	t.true(block.includes('        - governance-update'));
	t.true(block.startsWith('  # BEGIN AUTO-SLUGS'));
	t.true(block.endsWith('  # END AUTO-SLUGS'));
});

test('buildSlugBlock falls back to a free-text input when there are no slugs', t => {
	const block = buildSlugBlock([]);
	t.true(block.includes('  - type: input'));
	t.true(block.includes('No collective packs exist yet'));
});

test('rewrite swaps the bracketed block in place and leaves the rest untouched', t => {
	const before = [
		'name: example',
		'body:',
		'  - type: markdown',
		'    attributes:',
		'      value: header',
		'  # BEGIN AUTO-SLUGS — old marker text',
		'  - type: input',
		'    id: slug',
		'  # END AUTO-SLUGS',
		'  - type: textarea',
		'    id: request',
		'',
	].join('\n');

	const after = rewrite(before, ['foo', 'bar']);
	t.true(after.includes('  - type: markdown'));
	t.true(after.includes('  - type: dropdown'));
	t.true(after.includes('        - bar'));
	t.true(after.includes('        - foo'));
	t.true(after.includes('  - type: textarea'));
	t.false(after.includes('  - type: input\n    id: slug'));
});

test('rewrite throws when markers are missing', t => {
	t.throws(() => rewrite('no markers here', ['foo']), {
		message: /missing AUTO-SLUGS markers/,
	});
});
