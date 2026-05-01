/**
 * Tests for the validator. Each test builds a small content pack in a
 * temp directory, runs `runValidate({ ... })` against it, and asserts on
 * the structured Report. Fixtures live in-test (not on-disk) so the
 * scenario shape sits next to the assertion that uses it.
 *
 * Coverage targets:
 *  - Happy paths for each phase (channels / articles / full).
 *  - One test per failure rule the validator emits.
 *  - Soft-rule warnings (`min-words`, marketing-register) confirm they
 *    surface without blocking.
 *  - Sample-pack skip (`final_status: "sample"`).
 *  - Legacy back-compat: `personal/<member>/<channel>.md` files in old
 *    committed packs still parse cleanly even though the v2 pipeline no
 *    longer produces them.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {runValidate, type ValidatorConfig} from './validate-content';

const PRODUCT_SLUG = 'demo';
const PRODUCT_REPO = 'demo/demo';
const PRODUCT_REPO_URL = `https://github.com/${PRODUCT_REPO}`;
const VERSION = '1.0.0';
const PACK_ID = `${PRODUCT_SLUG}/${VERSION}`;

const CONFIG: ValidatorConfig = {
	products: [{slug: PRODUCT_SLUG, repo: PRODUCT_REPO}],
	channels: [
		{slug: 'linkedin', kind: 'social', min_words: 150, max_words: 500},
		{slug: 'x', kind: 'social', max_chars: 280},
		{
			slug: 'github-discussion',
			kind: 'long-form',
			min_words: 300,
			max_words: 3000,
		},
		{slug: 'reddit', kind: 'social', min_words: 150, max_words: 1500},
	],
};

// ~200-word body that hits all happy-path rules: includes the repo URL,
// no forbidden terms, no placeholders, no release-tag links.
const LONG_BODY = `${[
	'Demo v1.0.0 is out today.',
	'This release lands a structural change to how the demo loop handles tool registration.',
	'Previously the loop walked a flat array of registered tools each iteration; now it indexes them in a Map keyed by name, which means lookups are constant-time rather than linear in the number of registered tools.',
	'For small registries the difference is negligible.',
	'For projects that register dozens of tools, including via plugins, the savings add up over the lifetime of a session.',
	'Other notable changes include better error messages when a tool is registered twice, a fix for a long-standing bug where the loop would silently skip an iteration if the registry was modified during traversal, and a new diagnostic command that prints the registry state on demand.',
	'The full changelog is on the project repo.',
	'We rebuilt the test suite around the new shape so the change is locked in by tests and documented in the release notes.',
	'If you maintain a plugin that registers tools, the public API has not changed and your code should continue to work without modification.',
	'If you have feedback or hit edge cases we missed, the project lives at the repo linked above.',
	'Built by the demo team — a community collective shipping practical tooling.',
	`${PRODUCT_REPO_URL}`,
].join('\n\n')}`;

// X-shaped body: includes the URL, fits ≤ 280 chars.
const X_BODY = `Demo v1.0.0 is out. Tool registry now indexed by name — constant-time lookups, no behaviour changes for plugins. ${PRODUCT_REPO_URL}`;

// 50-word body — under the 150-word soft minimum for linkedin/reddit. Used
// only by the min-words warning test.
const SHORT_BODY = `Demo v1.0.0 is out. The registry walk is now O(1) per lookup. Plugins continue to work as before. ${PRODUCT_REPO_URL}`;

type FrontmatterOverrides = Partial<{
	product: string;
	version: string;
	channel: string;
	generated_at: string;
	model: string;
	char_count: number;
}>;

function buildMd(channel: string, body: string, fm: FrontmatterOverrides = {}) {
	const meta = {
		product: PRODUCT_SLUG,
		version: VERSION,
		channel,
		generated_at: '2026-05-01T00:00:00Z',
		model: 'test',
		char_count: body.length,
		...fm,
	};
	const lines = Object.entries(meta).map(([k, v]) => {
		if (v === undefined || v === null) return null;
		if (typeof v === 'string') return `${k}: "${v}"`;
		return `${k}: ${v}`;
	});
	const fmYaml = lines.filter(Boolean).join('\n');
	return `---\n${fmYaml}\n---\n${body}\n`;
}

function buildMeta(overrides: Record<string, unknown> = {}) {
	return JSON.stringify(
		{
			product: PRODUCT_SLUG,
			version: VERSION,
			product_url: PRODUCT_REPO_URL,
			generated_at: '2026-05-01T00:00:00Z',
			model: 'test',
			generation_attempts: 1,
			auto_fix_attempts: 0,
			final_status: 'passed',
			...overrides,
		},
		null,
		2,
	);
}

/**
 * Writes a complete happy-path pack: meta.json + four channel files. Tests
 * that need a deliberate failure mutate the result on disk before
 * validating.
 */
function writeHappyPack(contentRoot: string) {
	const packDir = join(contentRoot, PRODUCT_SLUG, VERSION);
	mkdirSync(join(packDir, 'channels'), {recursive: true});
	writeFileSync(join(packDir, 'meta.json'), buildMeta());
	writeFileSync(
		join(packDir, 'channels/linkedin.md'),
		buildMd('linkedin', LONG_BODY),
	);
	writeFileSync(join(packDir, 'channels/x.md'), buildMd('x', X_BODY));
	writeFileSync(
		join(packDir, 'channels/github-discussion.md'),
		buildMd('github-discussion', LONG_BODY),
	);
	writeFileSync(
		join(packDir, 'channels/reddit.md'),
		buildMd('reddit', LONG_BODY),
	);
	return packDir;
}

function writeArticle(
	packDir: string,
	slug: string,
	overrides: {body?: string} = {},
) {
	const articleDir = join(packDir, 'articles', slug);
	mkdirSync(join(articleDir, 'channels'), {recursive: true});
	writeFileSync(
		join(articleDir, 'meta.json'),
		JSON.stringify(
			{
				slug,
				title: 'Article title',
				focus: 'What this article is about.',
				generated_at: '2026-05-01T00:00:00Z',
				model: 'test',
			},
			null,
			2,
		),
	);
	const body = overrides.body ?? LONG_BODY;
	writeFileSync(
		join(articleDir, 'channels/linkedin.md'),
		buildMd('linkedin', body),
	);
	writeFileSync(join(articleDir, 'channels/x.md'), buildMd('x', X_BODY));
	writeFileSync(
		join(articleDir, 'channels/github-discussion.md'),
		buildMd('github-discussion', body),
	);
	writeFileSync(
		join(articleDir, 'channels/reddit.md'),
		buildMd('reddit', body),
	);
	return articleDir;
}

function makeTmpRoot(): string {
	return mkdtempSync(join(tmpdir(), 'cf-validate-spec-'));
}

function cleanup(root: string) {
	rmSync(root, {recursive: true, force: true});
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test('happy: channels-only pack passes at --phase channels', t => {
	const root = makeTmpRoot();
	try {
		writeHappyPack(root);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'channels',
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.deepEqual(report.scannedPacks, [PACK_ID]);
	} finally {
		cleanup(root);
	}
});

test('happy: channels + one article passes at --phase articles', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeArticle(packDir, 'registry-redesign');
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.true(report.scannedPacks.includes(`${PACK_ID}#registry-redesign`));
	} finally {
		cleanup(root);
	}
});

test('happy: channels + one article passes at --phase full (default)', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeArticle(packDir, 'registry-redesign');
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('happy: channels with zero articles passes at --phase articles (thin-release case)', t => {
	const root = makeTmpRoot();
	try {
		writeHappyPack(root);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test("skip: pack with final_status: 'sample' is skipped entirely", t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(
			join(packDir, 'meta.json'),
			buildMeta({final_status: 'sample'}),
		);
		// Even break a body — the pack should still skip cleanly.
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', 'Sovereign AI'),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.deepEqual(report.skippedPacks, [PACK_ID]);
		t.deepEqual(report.scannedPacks, []);
	} finally {
		cleanup(root);
	}
});

test("back-compat: legacy personal/<member>/<channel>.md files don't break validation", t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		mkdirSync(join(packDir, 'personal/will'), {recursive: true});
		writeFileSync(
			join(packDir, 'personal/will/linkedin.md'),
			buildMd('personal:will:linkedin', LONG_BODY),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

// ---------------------------------------------------------------------------
// Hard-rule failures (one test per rule)
// ---------------------------------------------------------------------------

test('fail: meta.json missing → meta-exists', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		rmSync(join(packDir, 'meta.json'));
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'meta-exists'));
	} finally {
		cleanup(root);
	}
});

test('fail: meta.json invalid JSON → meta-parses', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(join(packDir, 'meta.json'), '{not-json');
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'meta-parses'));
	} finally {
		cleanup(root);
	}
});

test('fail: missing channel file → file-exists', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		rmSync(join(packDir, 'channels/linkedin.md'));
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(
			report.failures.some(
				f => f.rule === 'file-exists' && f.expected.includes('linkedin'),
			),
		);
	} finally {
		cleanup(root);
	}
});

test('fail: frontmatter missing required field → frontmatter-shape', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// Write a file with no `model` field in the frontmatter.
		const broken = `---\nproduct: ${PRODUCT_SLUG}\nversion: "${VERSION}"\nchannel: "linkedin"\ngenerated_at: "2026-05-01T00:00:00Z"\nchar_count: 10\n---\n${LONG_BODY}\n`;
		writeFileSync(join(packDir, 'channels/linkedin.md'), broken);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(
			report.failures.some(
				f => f.rule === 'frontmatter-shape' && f.expected.includes('model'),
			),
		);
	} finally {
		cleanup(root);
	}
});

test('fail: frontmatter product mismatch → frontmatter-product', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', LONG_BODY, {product: 'wrong-product'}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'frontmatter-product'));
	} finally {
		cleanup(root);
	}
});

test('fail: frontmatter version mismatch → frontmatter-version', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', LONG_BODY, {version: '9.9.9'}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'frontmatter-version'));
	} finally {
		cleanup(root);
	}
});

test('fail: unknown channel slug in frontmatter → channel-known', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', LONG_BODY, {channel: 'mastodon'}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'channel-known'));
	} finally {
		cleanup(root);
	}
});

test('fail: X post over 280 chars → max-chars', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const oversized = `${'x '.repeat(150)}${PRODUCT_REPO_URL}`;
		writeFileSync(join(packDir, 'channels/x.md'), buildMd('x', oversized));
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'max-chars'));
	} finally {
		cleanup(root);
	}
});

test('fail: LinkedIn post over max_words → max-words', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// 600 words — over the 500 max.
		const tooLong = `${Array.from({length: 600}, () => 'demo').join(' ')} ${PRODUCT_REPO_URL}`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', tooLong),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'max-words'));
	} finally {
		cleanup(root);
	}
});

test('fail: forbidden brand-doc term → forbidden-term', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const body = `${LONG_BODY}\n\nBuilt with Sovereign AI principles.`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'forbidden-term'));
	} finally {
		cleanup(root);
	}
});

test('fail: unresolved {{TODO}} placeholder → no-placeholder', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const body = `${LONG_BODY}\n\n{{TODO write the actual ending}}`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'no-placeholder'));
	} finally {
		cleanup(root);
	}
});

test('fail: missing product repo URL → link-product-repo', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// LONG_BODY without the repo URL.
		const body = LONG_BODY.replace(PRODUCT_REPO_URL, '');
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'link-product-repo'));
	} finally {
		cleanup(root);
	}
});

test('fail: release-tag URL in body → link-not-release', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const body = `${LONG_BODY}\n\nFull notes: ${PRODUCT_REPO_URL}/releases/tag/v1.0.0`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'link-not-release'));
	} finally {
		cleanup(root);
	}
});

test('fail: more than 3 articles → articles-cap', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeArticle(packDir, 'one');
		writeArticle(packDir, 'two');
		writeArticle(packDir, 'three');
		writeArticle(packDir, 'four');
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'articles-cap'));
	} finally {
		cleanup(root);
	}
});

test('fail: article slug not kebab-case → article-slug-kebab-case', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeArticle(packDir, 'Bad_Slug');
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'article-slug-kebab-case'));
	} finally {
		cleanup(root);
	}
});

test('fail: article meta.json missing required field → article-meta-shape', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const articleDir = writeArticle(packDir, 'registry-redesign');
		// Overwrite the meta.json without `focus`.
		writeFileSync(
			join(articleDir, 'meta.json'),
			JSON.stringify(
				{
					slug: 'registry-redesign',
					title: 'Title',
					generated_at: '2026-05-01T00:00:00Z',
					model: 'test',
				},
				null,
				2,
			),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.true(
			report.failures.some(
				f => f.rule === 'article-meta-shape' && f.expected.includes('focus'),
			),
		);
	} finally {
		cleanup(root);
	}
});

test("fail: article slug doesn't match meta.slug → article-slug-matches", t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const articleDir = writeArticle(packDir, 'registry-redesign');
		writeFileSync(
			join(articleDir, 'meta.json'),
			JSON.stringify(
				{
					slug: 'wrong-slug',
					title: 'Title',
					focus: 'Focus.',
					generated_at: '2026-05-01T00:00:00Z',
					model: 'test',
				},
				null,
				2,
			),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'articles',
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'article-slug-matches'));
	} finally {
		cleanup(root);
	}
});

test('fail: pack directory missing → pack-exists', t => {
	const root = makeTmpRoot();
	try {
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'pack-exists'));
	} finally {
		cleanup(root);
	}
});

// ---------------------------------------------------------------------------
// Soft-rule warnings (must not block; must surface in report.warnings)
// ---------------------------------------------------------------------------

test('warn: short LinkedIn post produces min-words warning, not failure', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', SHORT_BODY),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.true(report.warnings.some(w => w.rule === 'min-words'));
	} finally {
		cleanup(root);
	}
});

test('warn: marketing-register term produces warning, not failure', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const body = `${LONG_BODY}\n\nThis is a transformative release.`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.true(report.warnings.some(w => w.rule === 'marketing-register'));
	} finally {
		cleanup(root);
	}
});
