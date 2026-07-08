import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	buildProductOptionsBlock,
	loadProductSlugs,
	rewrite,
} from './sync-release-products.js';

function makeProductsFile(slugs: string[]): string {
	const root = mkdtempSync(join(tmpdir(), 'cf-sync-products-'));
	const productsPath = join(root, 'products.json');
	const products = slugs.map(slug => ({
		slug,
		repo: `Nano-Collective/${slug}`,
	}));
	writeFileSync(productsPath, JSON.stringify(products));
	return productsPath;
}

test('loadProductSlugs: returns slugs in config order', t => {
	const path = makeProductsFile(['nanocoder', 'get-md', 'json-up']);
	t.deepEqual(loadProductSlugs(path), ['nanocoder', 'get-md', 'json-up']);
});

test('buildProductOptionsBlock: renders a dropdown when slugs exist', t => {
	const block = buildProductOptionsBlock(['nanocoder', 'get-md']);
	t.true(block.includes('  - type: dropdown'));
	t.true(block.includes('        - nanocoder'));
	t.true(block.includes('        - get-md'));
	t.true(block.startsWith('  # BEGIN AUTO-PRODUCTS'));
	t.true(block.endsWith('  # END AUTO-PRODUCTS'));
});

test('buildProductOptionsBlock: falls back to free-text input when empty', t => {
	const block = buildProductOptionsBlock([]);
	t.true(block.includes('  - type: input'));
	t.true(block.includes('No products are configured'));
});

test('rewrite: swaps the bracketed block in place', t => {
	const before = [
		'name: example',
		'body:',
		'  - type: markdown',
		'    attributes:',
		'      value: header',
		'  # BEGIN AUTO-PRODUCTS — old marker text',
		'  - type: input',
		'    id: product',
		'  # END AUTO-PRODUCTS',
		'  - type: input',
		'    id: version',
		'',
	].join('\n');

	const after = rewrite(before, ['nanocoder', 'nanotune']);
	t.true(after.includes('  - type: markdown'));
	t.true(after.includes('  - type: dropdown'));
	t.true(after.includes('        - nanocoder'));
	t.true(after.includes('        - nanotune'));
	t.true(after.includes('    id: version'));
});

test('rewrite: throws when markers are missing', t => {
	t.throws(() => rewrite('no markers here', ['nanocoder']), {
		message: /missing AUTO-PRODUCTS markers/,
	});
});
