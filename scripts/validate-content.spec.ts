/**
 * Tests for the validator. Each test builds a small content pack in a
 * temp directory, runs `runValidate({ ... })` against it, and asserts on
 * the structured Report. Fixtures live in-test (not on-disk) so the
 * scenario shape sits next to the assertion that uses it.
 *
 * Coverage targets:
 *  - Happy paths for each phase (channels / articles / full).
 *  - One test per failure rule the validator emits.
 *  - Soft-rule warnings (marketing-register) confirm they surface
 *    without blocking.
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

// ~320-word body that hits all happy-path rules: includes the repo URL,
// no forbidden terms, no placeholders, no release-tag links. Long enough
// to clear the 300-word github-discussion floor.
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
	'Built by the demo team, a community collective shipping practical tooling.',
	'A few notes on the migration path for plugin authors. The internal registry type is now a Map rather than an Array, but the public registration helpers continue to take the same arguments and return the same handle objects, so existing call sites compile without changes.',
	'If your plugin reaches into the registry directly via the (previously undocumented) array index you will need to switch to the named lookup helper exported alongside the registration API.',
	'We also took the opportunity to tighten the duplicate-registration path: registering the same tool name twice now throws at registration time rather than silently overwriting, which surfaces the kind of plugin conflict that previously caused confusing iteration-order bugs.',
	'On performance: the constant-time lookup matters most in tool-heavy sessions where the loop iterates many times across a registry that has grown via plugin installs.',
	`${PRODUCT_REPO_URL}`,
].join('\n\n')}`;

// X-shaped body: includes the URL, fits ≤ 280 chars.
const X_BODY = `Demo v1.0.0 is out. Tool registry now indexed by name: constant-time lookups, no behaviour changes for plugins. ${PRODUCT_REPO_URL}`;

// 50-word body — under the 150-word floor for linkedin/reddit. Used only
// by the min-words failure test.
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

test('fail: short LinkedIn post fails min-words', t => {
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
		t.true(report.failures.some(f => f.rule === 'min-words'));
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

test('fail: em-dash in body → em-dash', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const body = `${LONG_BODY}\n\nThis release ships fast — and stable.`;
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'em-dash'));
	} finally {
		cleanup(root);
	}
});

// ---------------------------------------------------------------------------
// Collective packs (content/_collective/<slug>/)
// ---------------------------------------------------------------------------

const COLLECTIVE_SLUG = 'economics-charter';
const COLLECTIVE_PACK_ID = `_collective/${COLLECTIVE_SLUG}`;
const COLLECTIVE_URL = 'https://nanocollective.org';

const COLLECTIVE_LONG_BODY = `${[
	'The Nano Collective shipped its economics charter today.',
	'The charter sets out how revenue from the collective is split, who gets paid, and on what cadence.',
	'It is short on philosophy and long on numbers; every clause references a specific project, a specific role, or a specific decision-making cadence.',
	'The intended audience is members and contributors who want to understand exactly what they are agreeing to before they ship code.',
	'The charter does not promise outcomes; it sets the rules of engagement, and we expect those rules to be revised as we learn what does and does not work in practice.',
	'Section one covers the revenue split between project maintainers, contributors, and the collective treasury, with worked examples for the most common shipping shapes (solo maintainer, two-person team, member-plus-external-contributor).',
	'Section two covers cadence: when payouts happen, how disputes are surfaced, and what the appeal path looks like if a member feels the split was applied incorrectly.',
	'Section three handles the edge cases that came up during the drafting process: projects that span multiple members, contributions that predate the charter, and the treatment of forks that re-join the main project.',
	'Section four sets out the review cadence for the charter itself: we expect to revise it every two quarters in the first year, then annually, with member-initiated amendments allowed at any time via the standard proposal process.',
	'Section five documents the calculations that sit behind the splits, including a worked example for a typical quarter, so members can replicate the numbers from public information and confirm they match the figures that land in their accounts.',
	'Section six covers tax and jurisdictional treatment at a high level, with pointers to the per-jurisdiction notes maintained separately, since those change more often than the charter itself and benefit from living closer to the relevant tax documentation.',
	'Read the full charter on the collective home and give us feedback in the relevant Discord channel.',
	`${COLLECTIVE_URL}/economics-charter`,
].join('\n\n')}`;

const COLLECTIVE_X_BODY = `New: the Nano Collective economics charter is live. Plain rules for who gets paid for what, on what cadence. ${COLLECTIVE_URL}`;

function buildCollectiveMd(
	channel: string,
	body: string,
	overrides: Partial<{
		kind: string;
		slug: string;
		channel: string;
		generated_at: string;
		model: string;
		char_count: number;
	}> = {},
) {
	const meta = {
		kind: 'collective',
		slug: COLLECTIVE_SLUG,
		channel,
		generated_at: '2026-05-01T00:00:00Z',
		model: 'test',
		char_count: body.length,
		...overrides,
	};
	const lines = Object.entries(meta).map(([k, v]) => {
		if (v === undefined || v === null) return null;
		if (typeof v === 'string') return `${k}: "${v}"`;
		return `${k}: ${v}`;
	});
	const fmYaml = lines.filter(Boolean).join('\n');
	return `---\n${fmYaml}\n---\n${body}\n`;
}

function writeHappyCollectivePack(contentRoot: string): string {
	const packDir = join(contentRoot, '_collective', COLLECTIVE_SLUG);
	mkdirSync(join(packDir, 'channels'), {recursive: true});
	writeFileSync(
		join(packDir, 'meta.json'),
		JSON.stringify(
			{
				kind: 'collective',
				slug: COLLECTIVE_SLUG,
				generated_at: '2026-05-01T00:00:00Z',
				model: 'test',
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(packDir, 'channels/linkedin.md'),
		buildCollectiveMd('linkedin', COLLECTIVE_LONG_BODY),
	);
	writeFileSync(
		join(packDir, 'channels/x.md'),
		buildCollectiveMd('x', COLLECTIVE_X_BODY),
	);
	writeFileSync(
		join(packDir, 'channels/github-discussion.md'),
		buildCollectiveMd('github-discussion', COLLECTIVE_LONG_BODY),
	);
	writeFileSync(
		join(packDir, 'channels/reddit.md'),
		buildCollectiveMd('reddit', COLLECTIVE_LONG_BODY),
	);
	return packDir;
}

test('collective: happy path passes when pack filter targets _collective/<slug>', t => {
	const root = makeTmpRoot();
	try {
		writeHappyCollectivePack(root);
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
			config: CONFIG,
		});
		t.deepEqual(report.failures, []);
		t.deepEqual(report.scannedPacks, [COLLECTIVE_PACK_ID]);
	} finally {
		cleanup(root);
	}
});

test('collective: included in default scan when no filter is set', t => {
	const root = makeTmpRoot();
	try {
		writeHappyCollectivePack(root);
		const report = runValidate({contentRoot: root, config: CONFIG});
		t.deepEqual(report.failures, []);
		t.true(report.scannedPacks.includes(COLLECTIVE_PACK_ID));
	} finally {
		cleanup(root);
	}
});

test('collective: missing collective URL → link-collective', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyCollectivePack(root);
		const body = COLLECTIVE_LONG_BODY.replaceAll(COLLECTIVE_URL, '');
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildCollectiveMd('linkedin', body),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'link-collective'));
	} finally {
		cleanup(root);
	}
});

test('collective: wrong frontmatter kind → frontmatter-kind', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyCollectivePack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildCollectiveMd('linkedin', COLLECTIVE_LONG_BODY, {kind: 'release'}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'frontmatter-kind'));
	} finally {
		cleanup(root);
	}
});

test('collective: slug mismatch → frontmatter-slug', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyCollectivePack(root);
		writeFileSync(
			join(packDir, 'channels/linkedin.md'),
			buildCollectiveMd('linkedin', COLLECTIVE_LONG_BODY, {slug: 'other'}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
			config: CONFIG,
		});
		t.true(report.failures.some(f => f.rule === 'frontmatter-slug'));
	} finally {
		cleanup(root);
	}
});

test('collective: missing channel file → file-exists', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyCollectivePack(root);
		rmSync(join(packDir, 'channels/linkedin.md'));
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
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

test('collective: non-kebab slug dir → collective-slug-kebab-case', t => {
	const root = makeTmpRoot();
	try {
		const badSlug = 'Bad_Slug';
		const packDir = join(root, '_collective', badSlug);
		mkdirSync(packDir, {recursive: true});
		const report = runValidate({contentRoot: root, config: CONFIG});
		t.true(report.failures.some(f => f.rule === 'collective-slug-kebab-case'));
	} finally {
		cleanup(root);
	}
});

test('collective: pack filter missing slug throws', t => {
	const root = makeTmpRoot();
	try {
		t.throws(
			() =>
				runValidate({
					contentRoot: root,
					packFilter: '_collective/',
					config: CONFIG,
				}),
			{message: /<slug>/},
		);
	} finally {
		cleanup(root);
	}
});

// ---------------------------------------------------------------------------
// kind: personal — files generated by the personal-pack pipeline. These nest
// under an existing release or collective pack at personal/<member>/<channel>.md
// and use team.json rules, not channels.json. Permissive link policy.
// ---------------------------------------------------------------------------

const TEAM_MEMBER_SLUG = 'will';
const TEAM = [
	{
		slug: TEAM_MEMBER_SLUG,
		name: 'Will Lamerton',
		github: 'willlamerton',
		role: 'Lead',
		voice: {tone: 't', do: ['a'], dont: ['b'], samples: []},
		channels: [
			{slug: 'linkedin', kind: 'social' as const, max_words: 500},
			{slug: 'x', kind: 'social' as const, max_chars: 280},
			{slug: 'medium', kind: 'long-form' as const, max_words: 2500},
		],
		agent_mode: 'bundled' as const,
	},
];

const CONFIG_WITH_TEAM: ValidatorConfig = {
	...CONFIG,
	team: TEAM,
};

function buildPersonalMd(args: {
	channel: string;
	body: string;
	member?: string;
	product?: string;
	version?: string;
	collectiveSlug?: string;
	overrides?: Record<string, unknown>;
}) {
	const meta: Record<string, unknown> = {
		kind: 'personal',
		member: args.member ?? TEAM_MEMBER_SLUG,
		channel: args.channel,
		generated_at: '2026-05-05T00:00:00Z',
		model: 'test',
		char_count: args.body.length,
		...(args.product && {product: args.product}),
		...(args.version && {version: args.version}),
		...(args.collectiveSlug && {slug: args.collectiveSlug}),
		...(args.overrides ?? {}),
	};
	const lines = Object.entries(meta).map(([k, v]) => {
		if (v === undefined || v === null) return null;
		if (typeof v === 'string') return `${k}: "${v}"`;
		return `${k}: ${v}`;
	});
	const fmYaml = lines.filter(Boolean).join('\n');
	return `---\n${fmYaml}\n---\n${args.body}\n`;
}

function writePersonalFile(
	packDir: string,
	channel: string,
	content: string,
	member: string = TEAM_MEMBER_SLUG,
) {
	const dir = join(packDir, 'personal', member);
	mkdirSync(dir, {recursive: true});
	writeFileSync(join(dir, `${channel}.md`), content);
}

// Body with a benign external link that's NOT the product repo URL — used to
// confirm the link-product-repo rule does NOT fire on personal files.
const PERSONAL_BODY = `${[
	'My take on the Demo v1.0.0 release.',
	'The shift from a flat array to a Map keyed by tool name is the kind of structural change that pays off long after the release notes scroll past.',
	'A few teams I work with register dozens of tools at startup; the previous code walked the whole array every iteration of the loop, and the cost was visible in long sessions.',
	'Constant-time lookups make that disappear.',
	'No public-API change, which is the rare combination of useful and uneventful.',
	'Worth picking up if you maintain a plugin or a long-running session.',
	'https://example.com/my-blog-post',
].join('\n\n')}`;

test('personal (product): happy path passes at --phase personal', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('personal (product): does not require the product repo URL (permissive link policy)', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// Body with NO product repo URL at all.
		const body = `${PERSONAL_BODY}\n\nNo repo link here, just my own.`;
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.false(report.failures.some(f => f.rule === 'link-product-repo'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): unknown member slug → team-member-known', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				member: 'unknown',
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
			'unknown',
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(report.failures.some(f => f.rule === 'team-member-known'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): channel not in member.channels → team-channel-known', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// reddit isn't in the test member's channels[].
		writePersonalFile(
			packDir,
			'reddit',
			buildPersonalMd({
				channel: 'reddit',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(report.failures.some(f => f.rule === 'team-channel-known'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): frontmatter member mismatch with directory → frontmatter-member', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				member: 'someone-else',
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
			TEAM_MEMBER_SLUG,
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(report.failures.some(f => f.rule === 'frontmatter-member'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): X over member.max_chars → max-chars', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const longBody = `x`.repeat(300);
		writePersonalFile(
			packDir,
			'x',
			buildPersonalMd({
				channel: 'x',
				body: longBody,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(report.failures.some(f => f.rule === 'max-chars'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): forbidden term in body → forbidden-term', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: `${PERSONAL_BODY}\n\nThe new Sovereign AI direction.`,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(report.failures.some(f => f.rule === 'forbidden-term'));
	} finally {
		cleanup(root);
	}
});

test('personal (product): additional channel not in base pack passes (member-only Medium)', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'medium',
			buildPersonalMd({
				channel: 'medium',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('personal (product): personalChannels filter scopes which files are checked', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// linkedin file deliberately tripping a hard rule (forbidden term);
		// x is clean. Filter to x — linkedin's failure must not surface.
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: `${PERSONAL_BODY}\n\nThe Sovereign AI angle.`,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		writePersonalFile(
			packDir,
			'x',
			buildPersonalMd({
				channel: 'x',
				body: `Quick take on Demo v1.0.0. ${PRODUCT_REPO_URL}`,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const scopedToX = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
			personalChannels: ['x'],
		});
		t.false(
			scopedToX.failures.some(f => f.file.endsWith('linkedin.md')),
			'linkedin failures must be filtered out when scoped to x',
		);
		// Without the filter, the linkedin failure surfaces normally.
		const unfiltered = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.true(
			unfiltered.failures.some(
				f => f.file.endsWith('linkedin.md') && f.rule === 'forbidden-term',
			),
			'linkedin forbidden-term failure should surface when filter is omitted',
		);
	} finally {
		cleanup(root);
	}
});

test('personal (product): --phase personal skips base-pack file-exists checks', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		// Sabotage the base pack — delete the canonical linkedin.md.
		rmSync(join(packDir, 'channels/linkedin.md'));
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('personal (collective): happy path passes at --phase personal', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyCollectivePack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				collectiveSlug: COLLECTIVE_SLUG,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: COLLECTIVE_PACK_ID,
			phase: 'personal',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('personal (full phase): personal files validated alongside base pack', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		writePersonalFile(
			packDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'full',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});

test('personal (article-level): nested under articles/<slug>/personal/<member>/', t => {
	const root = makeTmpRoot();
	try {
		const packDir = writeHappyPack(root);
		const articleDir = writeArticle(packDir, 'registry-redesign');
		writePersonalFile(
			articleDir,
			'linkedin',
			buildPersonalMd({
				channel: 'linkedin',
				body: PERSONAL_BODY,
				product: PRODUCT_SLUG,
				version: VERSION,
			}),
		);
		const report = runValidate({
			contentRoot: root,
			packFilter: PACK_ID,
			phase: 'full',
			config: CONFIG_WITH_TEAM,
		});
		t.deepEqual(report.failures, []);
	} finally {
		cleanup(root);
	}
});
