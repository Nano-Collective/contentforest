import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	compareVersionsDesc,
	listProducts,
	listVersions,
	readVersionPack,
} from './content.js';

function makeTempContentDir(): string {
	return mkdtempSync(join(tmpdir(), 'cf-content-'));
}

function writeFile(path: string, body: string) {
	mkdirSync(join(path, '..'), {recursive: true});
	writeFileSync(path, body, 'utf8');
}

test('compareVersionsDesc: newer version sorts first', t => {
	const versions = ['1.2.3', '2.0.0', '1.10.0', '1.9.0'];
	versions.sort(compareVersionsDesc);
	t.deepEqual(versions, ['2.0.0', '1.10.0', '1.9.0', '1.2.3']);
});

test('compareVersionsDesc: handles short version strings', t => {
	const versions = ['1.0', '1.0.5', '1.0.0'];
	versions.sort(compareVersionsDesc);
	t.deepEqual(versions, ['1.0.5', '1.0', '1.0.0']);
});

test('listProducts: returns empty array when content dir is missing', t => {
	const tmp = makeTempContentDir();
	rmSync(tmp, {recursive: true});
	t.deepEqual(listProducts(tmp), []);
});

test('listProducts: lists every product directory with its versions', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, 'nanocoder', '1.0.0'), {recursive: true});
	mkdirSync(join(tmp, 'nanocoder', '1.1.0'), {recursive: true});
	mkdirSync(join(tmp, 'nanotune', '0.5.0'), {recursive: true});
	const products = listProducts(tmp);
	const byslug = Object.fromEntries(products.map(p => [p.slug, p]));
	t.is(byslug.nanocoder.latestVersion, '1.1.0');
	t.deepEqual(byslug.nanocoder.versions, ['1.1.0', '1.0.0']);
	t.is(byslug.nanotune.latestVersion, '0.5.0');
	rmSync(tmp, {recursive: true});
});

test('listProducts: skips entries starting with underscore (e.g. _local)', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, 'nanocoder', '1.0.0'), {recursive: true});
	mkdirSync(join(tmp, '_local', '1.0.0'), {recursive: true});
	mkdirSync(join(tmp, '_test', '1.0.0'), {recursive: true});
	const slugs = listProducts(tmp).map(p => p.slug);
	t.deepEqual(slugs.sort(), ['nanocoder']);
	rmSync(tmp, {recursive: true});
});

test('listProducts: returns empty versions for product with no versions', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, 'nanocoder'), {recursive: true});
	const products = listProducts(tmp);
	t.is(products[0].latestVersion, null);
	t.deepEqual(products[0].versions, []);
	rmSync(tmp, {recursive: true});
});

test('listVersions: returns versions for a single product, newest first', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, 'nanocoder', '1.0.0'), {recursive: true});
	mkdirSync(join(tmp, 'nanocoder', '1.10.0'), {recursive: true});
	mkdirSync(join(tmp, 'nanocoder', '1.9.0'), {recursive: true});
	t.deepEqual(listVersions('nanocoder', tmp), ['1.10.0', '1.9.0', '1.0.0']);
	rmSync(tmp, {recursive: true});
});

test('listVersions: returns empty array for unknown product', t => {
	const tmp = makeTempContentDir();
	t.deepEqual(listVersions('does-not-exist', tmp), []);
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: reads channels/*.md and parses frontmatter', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'channels/linkedin.md'),
		'---\nproduct: nanocoder\nversion: 1.0.0\nchannel: linkedin\n---\n\nBody text.',
	);
	writeFile(
		join(root, 'channels/x.md'),
		'---\nproduct: nanocoder\nversion: 1.0.0\nchannel: x\n---\n\nShort post.',
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.is(pack.product, 'nanocoder');
	t.is(pack.version, '1.0.0');
	t.is(pack.files.length, 2);
	const channels = pack.files.map(f => f.channel).sort();
	t.deepEqual(channels, ['linkedin', 'x']);
	const linkedin = pack.files.find(f => f.channel === 'linkedin');
	t.truthy(linkedin);
	t.is(linkedin?.frontmatter.product, 'nanocoder');
	t.is(linkedin?.body.trim(), 'Body text.');
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: reads meta.json from pack root', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	mkdirSync(root, {recursive: true});
	writeFileSync(
		join(root, 'meta.json'),
		JSON.stringify({final_status: 'validated'}),
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.deepEqual(pack.meta, {final_status: 'validated'});
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: meta is null when meta.json is missing', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	mkdirSync(root, {recursive: true});
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.is(pack.meta, null);
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: reads articles/<slug>/channels/*.md with article: prefix', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'channels/linkedin.md'),
		'---\nchannel: linkedin\n---\n\nMain.',
	);
	writeFile(
		join(root, 'articles/mcp-support/channels/linkedin.md'),
		'---\nchannel: linkedin\n---\n\nArticle.',
	);
	mkdirSync(join(root, 'articles/mcp-support'), {recursive: true});
	writeFileSync(
		join(root, 'articles/mcp-support/meta.json'),
		JSON.stringify({slug: 'mcp-support'}),
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.is(pack.files.length, 2);
	const articleFile = pack.files.find(f =>
		f.channel.startsWith('article:mcp-support:'),
	);
	t.truthy(articleFile);
	t.is(articleFile?.channel, 'article:mcp-support:linkedin');
	t.is(pack.articles.length, 1);
	t.is(pack.articles[0].slug, 'mcp-support');
	t.deepEqual(pack.articles[0].meta, {slug: 'mcp-support'});
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: sorts articles by slug', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	mkdirSync(join(root, 'articles/zebra'), {recursive: true});
	mkdirSync(join(root, 'articles/alpha'), {recursive: true});
	mkdirSync(join(root, 'articles/middle'), {recursive: true});
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.deepEqual(
		pack.articles.map(a => a.slug),
		['alpha', 'middle', 'zebra'],
	);
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: handles personal/<member>/<channel>.md back-compat', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'personal/will/linkedin.md'),
		'---\nchannel: linkedin\n---\n\nPersonal.',
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	const personal = pack.files.find(f => f.channel.startsWith('personal:'));
	t.is(personal?.channel, 'personal:will:linkedin');
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: handles flat personal/<member>-<channel>.md back-compat', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'personal/will-linkedin.md'),
		'---\nchannel: linkedin\n---\n\nFlat.',
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	const personal = pack.files.find(f => f.channel.startsWith('personal:'));
	t.is(personal?.channel, 'personal:will:linkedin');
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: empty pack root returns empty files and articles', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	mkdirSync(root, {recursive: true});
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.deepEqual(pack.files, []);
	t.deepEqual(pack.articles, []);
	rmSync(tmp, {recursive: true});
});

test('readVersionPack: round-trips Date frontmatter to ISO strings', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'channels/x.md'),
		'---\nchannel: x\ngenerated_at: 2026-05-01T10:00:00Z\n---\n\nBody.',
	);
	const pack = readVersionPack('nanocoder', '1.0.0', tmp);
	t.is(typeof pack.files[0].frontmatter.generated_at, 'string');
	rmSync(tmp, {recursive: true});
});
