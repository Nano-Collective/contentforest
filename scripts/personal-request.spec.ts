import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import type {TeamChannel, TeamMember} from '../lib/team.js';
import {
	articleEligibleChannels,
	basePackDir,
	basePackId,
	buildArticlesEditPrompt,
	buildArticlesPrompt,
	buildAutoFixPrompt,
	buildChannelsEditPrompt,
	buildChannelsPrompt,
	type JobSpec,
	listArticleSlugs,
	listBasePackChannels,
	planChannelSpawns,
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
	agent_mode: 'bundled',
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

test('buildChannelsPrompt: substitutes CONTEXT when present', t => {
	const prompt = buildChannelsPrompt({
		job: {
			...PRODUCT_JOB,
			context: 'Tighten the LinkedIn post — drop the closing CTA.',
		},
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		mirrored: [MEMBER.channels[0]],
		additional: [],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /Tighten the LinkedIn post — drop the closing CTA\./);
	t.notRegex(prompt, /\{\{CONTEXT\}\}/);
});

test('buildChannelsPrompt: defaults CONTEXT to "(none)" when null', t => {
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
	// "(none)" appears at least in the change-request block.
	t.regex(prompt, /Additional context \/ change request:[\s\S]*\(none\)/);
	t.notRegex(prompt, /\{\{CONTEXT\}\}/);
});

test('buildArticlesPrompt: substitutes CONTEXT when present', t => {
	const prompt = buildArticlesPrompt({
		job: {
			...PRODUCT_JOB,
			context: 'Lean harder into the architecture angle.',
		},
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		articleSlugs: ['registry-redesign'],
		mirroredAndAdditional: [MEMBER.channels[0]],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /Lean harder into the architecture angle\./);
	t.notRegex(prompt, /\{\{CONTEXT\}\}/);
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

test('buildChannelsEditPrompt: leads with the change request as a directive', t => {
	const prompt = buildChannelsEditPrompt({
		job: {
			...PRODUCT_JOB,
			context:
				'Reword the opening line "Why write it yourself when your agents can handle it?" — too lazy.',
		},
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		generatedAt: '2026-05-06T00:00:00Z',
		model: 'minimax-m2.7',
	});
	// Change request is present and prominent (in the "non-negotiable" section).
	t.regex(prompt, /Why write it yourself when your agents can handle it\?/);
	t.regex(prompt, /non-negotiable/i);
	// Member voice is present as calibration.
	t.regex(prompt, /Will Lamerton/);
	// Drops create-mode framing — no "produce personal-voice channel posts based on".
	t.notRegex(prompt, /Channels to mirror/);
	t.notRegex(prompt, /Channels to add/);
	// Placeholders all consumed.
	t.notRegex(prompt, /\{\{CONTEXT\}\}/);
	t.notRegex(prompt, /\{\{MEMBER_NAME\}\}/);
	t.notRegex(prompt, /\{\{TARGET_DIR\}\}/);
});

test('buildArticlesEditPrompt: leads with the change request and lists article slugs', t => {
	const prompt = buildArticlesEditPrompt({
		job: {
			...PRODUCT_JOB,
			context: 'Tighten the LinkedIn post in the registry-redesign article.',
		},
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		articleSlugs: ['registry-redesign', 'auto-compact'],
		generatedAt: '2026-05-06T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /Tighten the LinkedIn post/);
	t.regex(prompt, /registry-redesign/);
	t.regex(prompt, /auto-compact/);
	t.regex(prompt, /non-negotiable/i);
	t.notRegex(prompt, /\{\{CONTEXT\}\}/);
	t.notRegex(prompt, /\{\{ARTICLE_SLUGS\}\}/);
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

// ---------------------------------------------------------------------------
// planChannelSpawns + per-channel prompt scoping
// ---------------------------------------------------------------------------

test('planChannelSpawns: bundled mode returns a single spawn covering all channels', t => {
	const spawns = planChannelSpawns({
		member: MEMBER,
		mirrored: [MEMBER.channels[0]],
		additional: [MEMBER.channels[1], MEMBER.channels[2]],
	});
	t.is(spawns.length, 1);
	t.is(spawns[0].label, 'all');
	t.deepEqual(
		spawns[0].channels.map(c => c.slug),
		['linkedin', 'x', 'medium'],
	);
});

test('planChannelSpawns: per-channel mode returns one spawn per bundle group', t => {
	const perChannelMember: TeamMember = {
		...MEMBER,
		agent_mode: 'per-channel',
		channels: [
			{slug: 'linkedin', kind: 'social', max_words: 500},
			{
				slug: 'linkedin-newsletter',
				kind: 'long-form',
				max_words: 2000,
				bundle_with: ['linkedin'],
			},
			{slug: 'x', kind: 'social', max_chars: 280},
			{slug: 'substack', kind: 'long-form', max_words: 3000},
		],
	};
	const spawns = planChannelSpawns({
		member: perChannelMember,
		mirrored: [perChannelMember.channels[0], perChannelMember.channels[2]],
		additional: [perChannelMember.channels[1], perChannelMember.channels[3]],
	});
	// 3 groups: {linkedin, linkedin-newsletter}, {x}, {substack}
	t.is(spawns.length, 3);
	const labels = spawns.map(s => s.label).sort();
	t.deepEqual(labels, ['linkedin-linkedin-newsletter', 'substack', 'x']);
	const linkedinSpawn = spawns.find(s =>
		s.channels.some(c => c.slug === 'linkedin-newsletter'),
	)!;
	t.deepEqual(
		linkedinSpawn.mirrored.map(c => c.slug),
		['linkedin'],
	);
	t.deepEqual(
		linkedinSpawn.additional.map(c => c.slug),
		['linkedin-newsletter'],
	);
});

test('planChannelSpawns: per-channel mode drops groups with no in-scope channels', t => {
	const perChannelMember: TeamMember = {
		...MEMBER,
		agent_mode: 'per-channel',
	};
	// Only linkedin is in scope (mirrored). x and medium are not in scope at all.
	const spawns = planChannelSpawns({
		member: perChannelMember,
		mirrored: [perChannelMember.channels[0]],
		additional: [],
	});
	t.is(spawns.length, 1);
	t.is(spawns[0].label, 'linkedin');
});

test('buildChannelsPrompt: inScopeChannels filters MEMBER_CHANNELS_JSON to the spawn', t => {
	const prompt = buildChannelsPrompt({
		job: PRODUCT_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		mirrored: [MEMBER.channels[0]],
		additional: [],
		inScopeChannels: [MEMBER.channels[0]],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	// In-scope channel is present; out-of-scope channels are not.
	t.regex(prompt, /"slug": "linkedin"/);
	t.notRegex(prompt, /"slug": "x"/);
	t.notRegex(prompt, /"slug": "medium"/);
	// Self-check command must include the channel filter, quoted so multi-
	// channel groups survive shell tokenisation.
	t.regex(prompt, /--personal-channels "linkedin"/);
});

test('articleEligibleChannels: includes channels with articles undefined (default true)', t => {
	const channels: TeamChannel[] = [
		{slug: 'a', kind: 'social'},
		{slug: 'b', kind: 'social'},
	];
	t.is(articleEligibleChannels(channels).length, 2);
});

test('articleEligibleChannels: filters out channels with articles: false', t => {
	const channels: TeamChannel[] = [
		{slug: 'linkedin', kind: 'social'},
		{slug: 'substack', kind: 'long-form', articles: false},
		{slug: 'x', kind: 'social', articles: true},
	];
	t.deepEqual(
		articleEligibleChannels(channels).map(c => c.slug),
		['linkedin', 'x'],
	);
});

test('buildChannelsPrompt: default inScopeChannels covers all member channels (bundled mode)', t => {
	const prompt = buildChannelsPrompt({
		job: PRODUCT_JOB,
		member: MEMBER,
		packDir: '/tmp/pack',
		packId: 'nanocoder/1.25.0',
		mirrored: [MEMBER.channels[0]],
		additional: [MEMBER.channels[1], MEMBER.channels[2]],
		generatedAt: '2026-05-05T00:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /"slug": "linkedin"/);
	t.regex(prompt, /"slug": "x"/);
	t.regex(prompt, /"slug": "medium"/);
	t.regex(prompt, /--personal-channels "linkedin, x, medium"/);
});
