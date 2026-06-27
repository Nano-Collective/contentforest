import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	type ContentFile,
	compareVersionsDesc,
	isPackDealtWith,
	listCollectivePacks,
	listProducts,
	listVersions,
	listWeeklyPacks,
	readCollectivePack,
	readVersionPack,
	readWeeklyPack,
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

test('listCollectivePacks: returns empty array when _collective is missing', t => {
	const tmp = makeTempContentDir();
	t.deepEqual(listCollectivePacks(tmp), []);
	rmSync(tmp, {recursive: true});
});

test('listCollectivePacks: lists every pack with its meta', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, '_collective', 'launch'), {recursive: true});
	mkdirSync(join(tmp, '_collective', 'economics-charter'), {recursive: true});
	writeFileSync(
		join(tmp, '_collective', 'launch', 'meta.json'),
		JSON.stringify({slug: 'launch', generated_at: '2026-05-01T00:00:00Z'}),
	);
	writeFileSync(
		join(tmp, '_collective', 'economics-charter', 'meta.json'),
		JSON.stringify({
			slug: 'economics-charter',
			generated_at: '2026-04-15T00:00:00Z',
		}),
	);
	const packs = listCollectivePacks(tmp);
	t.deepEqual(
		packs.map(p => p.slug),
		['launch', 'economics-charter'],
	);
	t.is(packs[0].meta?.slug, 'launch');
	rmSync(tmp, {recursive: true});
});

test('listCollectivePacks: packs without meta sort to the bottom by slug', t => {
	const tmp = makeTempContentDir();
	mkdirSync(join(tmp, '_collective', 'zebra'), {recursive: true});
	mkdirSync(join(tmp, '_collective', 'alpha'), {recursive: true});
	const packs = listCollectivePacks(tmp);
	t.deepEqual(
		packs.map(p => p.slug),
		['alpha', 'zebra'],
	);
	rmSync(tmp, {recursive: true});
});

test('readCollectivePack: reads channels/*.md and meta.json', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, '_collective', 'launch');
	writeFile(
		join(root, 'channels/linkedin.md'),
		'---\nkind: collective\nslug: launch\nchannel: linkedin\n---\n\nAnnouncement.',
	);
	writeFile(
		join(root, 'channels/x.md'),
		'---\nkind: collective\nslug: launch\nchannel: x\n---\n\nShort.',
	);
	mkdirSync(root, {recursive: true});
	writeFileSync(
		join(root, 'meta.json'),
		JSON.stringify({kind: 'collective', slug: 'launch'}),
	);
	const pack = readCollectivePack('launch', tmp);
	t.is(pack.slug, 'launch');
	t.is(pack.files.length, 2);
	t.deepEqual(pack.files.map(f => f.channel).sort(), ['linkedin', 'x']);
	t.is(pack.meta?.kind, 'collective');
	rmSync(tmp, {recursive: true});
});

test('readCollectivePack: returns empty files when pack dir is missing', t => {
	const tmp = makeTempContentDir();
	const pack = readCollectivePack('does-not-exist', tmp);
	t.deepEqual(pack.files, []);
	t.is(pack.meta, null);
	rmSync(tmp, {recursive: true});
});

function mkFile(
	channel: string,
	frontmatter: Record<string, unknown>,
): ContentFile {
	return {
		path: `/content/${channel}.md`,
		repoPath: `content/${channel}.md`,
		channel,
		raw: '',
		body: '',
		frontmatter,
	};
}

test('isPackDealtWith: empty pack is not dealt with', t => {
	t.false(isPackDealtWith([]));
});

test('isPackDealtWith: single file with no marks is not dealt with', t => {
	t.false(isPackDealtWith([mkFile('linkedin', {channel: 'linkedin'})]));
});

test('isPackDealtWith: single file marked distributed is dealt with', t => {
	t.true(
		isPackDealtWith([
			mkFile('linkedin', {
				channel: 'linkedin',
				distributed_at: '2026-05-08T10:00:00Z',
			}),
		]),
	);
});

test('isPackDealtWith: single file marked wont_use is dealt with', t => {
	t.true(
		isPackDealtWith([
			mkFile('linkedin', {
				channel: 'linkedin',
				wont_use_at: '2026-05-08T10:00:00Z',
			}),
		]),
	);
});

test('isPackDealtWith: all files distributed is dealt with', t => {
	t.true(
		isPackDealtWith([
			mkFile('linkedin', {distributed_at: '2026-05-08T10:00:00Z'}),
			mkFile('x', {distributed_at: '2026-05-08T10:05:00Z'}),
		]),
	);
});

test('isPackDealtWith: all files wont_use is dealt with', t => {
	t.true(
		isPackDealtWith([
			mkFile('linkedin', {wont_use_at: '2026-05-08T10:00:00Z'}),
			mkFile('x', {wont_use_at: '2026-05-08T10:05:00Z'}),
		]),
	);
});

test('isPackDealtWith: mixed distributed and wont_use is dealt with', t => {
	t.true(
		isPackDealtWith([
			mkFile('linkedin', {distributed_at: '2026-05-08T10:00:00Z'}),
			mkFile('x', {wont_use_at: '2026-05-08T10:05:00Z'}),
		]),
	);
});

test('isPackDealtWith: any single unmarked file means not dealt with', t => {
	t.false(
		isPackDealtWith([
			mkFile('linkedin', {distributed_at: '2026-05-08T10:00:00Z'}),
			mkFile('x', {channel: 'x'}),
		]),
	);
});

test('isPackDealtWith: non-string distributed_at is treated as unmarked', t => {
	// Defense in depth: readVersionPack round-trips dates through JSON, but if
	// a caller ever hand-builds a ContentFile with a Date object, we still
	// want a stable boolean instead of a crash.
	const date = new Date('2026-05-08T10:00:00Z');
	t.false(
		isPackDealtWith([mkFile('x', {distributed_at: date as unknown as string})]),
	);
});

test('listWeeklyPacks: returns empty array when _weekly is missing', t => {
	const tmp = makeTempContentDir();
	rmSync(tmp, {recursive: true});
	t.deepEqual(listWeeklyPacks(tmp), []);
});

test('listWeeklyPacks: lists packs newest-first with their meta', t => {
	const tmp = makeTempContentDir();
	writeFile(
		join(tmp, '_weekly', '2026-06-22', 'meta.json'),
		JSON.stringify({kind: 'weekly', picks: [{channel: 'reddit'}]}),
	);
	writeFile(
		join(tmp, '_weekly', '2026-06-29', 'meta.json'),
		JSON.stringify({kind: 'weekly', picks: []}),
	);
	const packs = listWeeklyPacks(tmp);
	t.deepEqual(
		packs.map(p => p.date),
		['2026-06-29', '2026-06-22'],
	);
	t.is((packs[1].meta?.picks as unknown[]).length, 1);
	rmSync(tmp, {recursive: true});
});

test('readWeeklyPack: reads digest.md and meta.json', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, '_weekly', '2026-06-29');
	writeFile(
		join(root, 'digest.md'),
		'---\nkind: weekly\nweek_of: "2026-06-29"\n---\n\n# Weekly content pack',
	);
	writeFile(join(root, 'meta.json'), JSON.stringify({kind: 'weekly'}));
	const pack = readWeeklyPack('2026-06-29', tmp);
	t.is(pack.date, '2026-06-29');
	t.is(pack.meta?.kind, 'weekly');
	t.truthy(pack.digest);
	t.is(pack.digest?.channel, 'digest');
	t.true(pack.digest?.body.includes('# Weekly content pack'));
	rmSync(tmp, {recursive: true});
});

test('readWeeklyPack: returns null digest when digest.md is absent', t => {
	const tmp = makeTempContentDir();
	writeFile(
		join(tmp, '_weekly', '2026-06-29', 'meta.json'),
		JSON.stringify({kind: 'weekly', final_status: 'empty'}),
	);
	const pack = readWeeklyPack('2026-06-29', tmp);
	t.is(pack.digest, null);
	t.is(pack.meta?.final_status, 'empty');
	rmSync(tmp, {recursive: true});
});

test('isPackDealtWith: integrates with readVersionPack on real files', t => {
	const tmp = makeTempContentDir();
	const root = join(tmp, 'nanocoder', '1.0.0');
	writeFile(
		join(root, 'channels/linkedin.md'),
		'---\nchannel: linkedin\ndistributed_at: "2026-05-08T10:00:00Z"\n---\n\nDone.',
	);
	writeFile(
		join(root, 'channels/x.md'),
		'---\nchannel: x\nwont_use_at: "2026-05-08T10:05:00Z"\n---\n\nSkipped.',
	);
	t.true(isPackDealtWith(readVersionPack('nanocoder', '1.0.0', tmp).files));

	// Now unmark one of them and re-check.
	writeFile(
		join(root, 'channels/x.md'),
		'---\nchannel: x\n---\n\nBack to unmarked.',
	);
	t.false(isPackDealtWith(readVersionPack('nanocoder', '1.0.0', tmp).files));

	rmSync(tmp, {recursive: true});
});
