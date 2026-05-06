import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import type {TeamMember} from '../lib/team.js';
import {
	basePackDir,
	basePackId,
	buildArticlesPrompt,
	buildAutoFixPrompt,
	buildChannelsPrompt,
	type JobSpec,
	listArticleSlugs,
	listBasePackChannels,
	substitute,
} from './personal-request.js';

const PRODUCT_JOB: JobSpec = {
	memberSlug: 'will',
	basePackKind: 'product',
	basePackId: 'nanocoder/1.25.0',
	context: null,
	requester: 'will',
	issueNumber: 42,
};

const COLLECTIVE_JOB: JobSpec = {
	memberSlug: 'will',
	basePackKind: 'collective',
	basePackId: 'contentforest-launch',
	context: null,
	requester: 'will',
	issueNumber: 7,
};

const MEMBER: TeamMember = {
	slug: 'will',
	name: 'Will Lamerton',
	github: 'willlamerton',
	role: 'Lead',
	voice: {
		tone: 'operational, plainspoken',
		do: ['lead with the operational detail'],
		dont: ['use hashtags'],
		samples: [],
	},
	channels: [
		{slug: 'linkedin', kind: 'social', max_words: 500},
		{slug: 'x', kind: 'social', max_chars: 280},
		{slug: 'medium', kind: 'long-form', max_words: 2500},
	],
};

test('substitute: replaces all occurrences', t => {
	t.is(substitute('{{X}}.{{X}}', {X: 'a'}), 'a.a');
});

test('substitute: leaves unknown placeholders intact', t => {
	t.is(substitute('{{A}} {{B}}', {A: '1'}), '1 {{B}}');
});

test('basePackDir: product pack resolves to <root>/<product>/<version>', t => {
	const dir = basePackDir(PRODUCT_JOB);
	t.regex(dir, /content\/nanocoder\/1\.25\.0$/);
});

test('basePackDir: collective pack resolves to <root>/_collective/<slug>', t => {
	const dir = basePackDir(COLLECTIVE_JOB);
	t.regex(dir, /content\/_collective\/contentforest-launch$/);
});

test('basePackId: product returns the bare id', t => {
	t.is(basePackId(PRODUCT_JOB), 'nanocoder/1.25.0');
});

test('basePackId: collective prefixes with _collective/', t => {
	t.is(basePackId(COLLECTIVE_JOB), '_collective/contentforest-launch');
});

test('listBasePackChannels: returns channel slugs sorted', t => {
	const root = mkdtempSync(join(tmpdir(), 'cf-personal-spec-'));
	try {
		const channelsDir = join(root, 'channels');
		mkdirSync(channelsDir, {recursive: true});
		writeFileSync(join(channelsDir, 'reddit.md'), '');
		writeFileSync(join(channelsDir, 'linkedin.md'), '');
		writeFileSync(join(channelsDir, 'x.md'), '');
		writeFileSync(join(channelsDir, 'README'), ''); // ignored — not .md
		t.deepEqual(listBasePackChannels(root), ['linkedin', 'reddit', 'x']);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('listBasePackChannels: returns empty array when channels/ missing', t => {
	const root = mkdtempSync(join(tmpdir(), 'cf-personal-spec-'));
	try {
		t.deepEqual(listBasePackChannels(root), []);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('listArticleSlugs: returns directory names sorted', t => {
	const root = mkdtempSync(join(tmpdir(), 'cf-personal-spec-'));
	try {
		mkdirSync(join(root, 'articles/registry-redesign'), {recursive: true});
		mkdirSync(join(root, 'articles/auto-compact'), {recursive: true});
		t.deepEqual(listArticleSlugs(root), ['auto-compact', 'registry-redesign']);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('listArticleSlugs: returns empty when articles/ missing (collective packs)', t => {
	const root = mkdtempSync(join(tmpdir(), 'cf-personal-spec-'));
	try {
		t.deepEqual(listArticleSlugs(root), []);
	} finally {
		rmSync(root, {recursive: true, force: true});
	}
});

test('buildChannelsPrompt: substitutes member voice and channel split (product)', t => {
	const prompt = buildChannelsPrompt({
		job: PRODUCT_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		mirrored: [MEMBER.channels[0]],
		additional: [MEMBER.channels[2]],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	// Member-specific
	t.regex(prompt, /Will Lamerton/);
	t.regex(prompt, /operational, plainspoken/);
	t.regex(prompt, /lead with the operational detail/);
	// Channel split
	t.regex(prompt, /linkedin/);
	t.regex(prompt, /medium/);
	// Base pack id
	t.regex(prompt, /nanocoder\/1\.25\.0/);
	// All placeholders consumed
	t.notRegex(prompt, /\{\{MEMBER_SLUG\}\}/);
	t.notRegex(prompt, /\{\{MEMBER_NAME\}\}/);
	t.notRegex(prompt, /\{\{MEMBER_VOICE_TONE\}\}/);
	t.notRegex(prompt, /\{\{BASE_PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{PRODUCT_SLUG\}\}/);
	t.notRegex(prompt, /\{\{VERSION\}\}/);
	t.notRegex(prompt, /\{\{BASE_FRONTMATTER_HINTS\}\}/);
});

test('buildChannelsPrompt: collective pack substitutes slug-based frontmatter hints', t => {
	const prompt = buildChannelsPrompt({
		job: COLLECTIVE_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: '_collective/contentforest-launch',
		mirrored: [MEMBER.channels[0]],
		additional: [],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /slug: contentforest-launch/);
	t.notRegex(prompt, /product:/);
});

test('buildChannelsPrompt: empty additional list renders "(none)"', t => {
	const prompt = buildChannelsPrompt({
		job: PRODUCT_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		mirrored: [MEMBER.channels[0]],
		additional: [],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /Channels to add[^\n]*\(none\)/);
});

test('buildArticlesPrompt: includes article slugs and product/version', t => {
	const prompt = buildArticlesPrompt({
		job: PRODUCT_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		articleSlugs: ['registry-redesign', 'auto-compact'],
		mirroredAndAdditional: [MEMBER.channels[0], MEMBER.channels[1]],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /registry-redesign/);
	t.regex(prompt, /auto-compact/);
	t.regex(prompt, /nanocoder/);
	t.regex(prompt, /1\.25\.0/);
	t.notRegex(prompt, /\{\{ARTICLE_SLUGS\}\}/);
	t.notRegex(prompt, /\{\{PRODUCT_SLUG\}\}/);
});

test('buildAutoFixPrompt: substitutes attempt counters and error report', t => {
	const prompt = buildAutoFixPrompt({
		originalPrompt: 'ORIGINAL_BODY',
		errorReport: '[{"rule":"max-chars"}]',
		packDir: '/tmp/pack',
		attemptNumber: 2,
		maxAttempts: 3,
	});
	t.regex(prompt, /max-chars/);
	t.regex(prompt, /ORIGINAL_BODY/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{ATTEMPT_NUMBER\}\}/);
});
