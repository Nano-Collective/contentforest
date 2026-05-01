import test from 'ava';
import {
	AGENTS,
	type AgentSpec,
	buildAgentPrompt,
	buildAutoFixPrompt,
	buildPromptVars,
	type JobSpec,
	type Product,
	packDirFor,
	substitute,
	validatorRootFor,
} from './generate-content.js';

const PRODUCT: Product = {slug: 'nanocoder', repo: 'Nano-Collective/nanocoder'};

const JOB: JobSpec = {
	product: 'nanocoder',
	version: '1.25.2',
	releaseBody: '## What changed\n\n- foo\n- bar',
	releaseTagUrl:
		'https://github.com/Nano-Collective/nanocoder/releases/tag/v1.25.2',
};

test('AGENTS: pipeline is the two-agent shape (release-channels → article-channels)', t => {
	t.deepEqual(
		AGENTS.map(a => a.slug),
		['release-channels', 'article-channels'],
	);
	t.is(AGENTS[0].phase, 'channels');
	t.is(AGENTS[1].phase, 'articles');
	t.true(AGENTS[0].promptFile.endsWith('release-channels.md'));
	t.true(AGENTS[1].promptFile.endsWith('article-channels.md'));
});

test('packDirFor: commit mode writes under content/<product>/<version>/', t => {
	t.true(
		packDirFor('commit', 'nanocoder', '1.0.0').endsWith(
			'/content/nanocoder/1.0.0',
		),
	);
});

test('packDirFor: local mode writes under content/_local/', t => {
	t.true(
		packDirFor('local', 'nanocoder', '1.0.0').endsWith(
			'/content/_local/nanocoder/1.0.0',
		),
	);
});

test('packDirFor: test mode writes under content/_test/', t => {
	t.true(
		packDirFor('test', 'nanocoder', '1.0.0').endsWith(
			'/content/_test/nanocoder/1.0.0',
		),
	);
});

test('validatorRootFor: maps each mode to its validator root', t => {
	t.is(validatorRootFor('commit'), 'content');
	t.is(validatorRootFor('local'), 'content/_local');
	t.is(validatorRootFor('test'), 'content/_test');
});

test('substitute: replaces a single template variable', t => {
	t.is(substitute('hello {{NAME}}', {NAME: 'world'}), 'hello world');
});

test('substitute: replaces all occurrences of the same key', t => {
	t.is(substitute('{{X}}.{{X}}', {X: 'a'}), 'a.a');
});

test('substitute: leaves unknown placeholders intact', t => {
	t.is(substitute('{{A}} {{B}}', {A: 'x'}), 'x {{B}}');
});

test('substitute: empty vars map returns the template untouched', t => {
	t.is(substitute('hello {{X}}', {}), 'hello {{X}}');
});

test('buildPromptVars: produces every variable an agent prompt can need', t => {
	const vars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content/_local',
	});
	t.is(vars.PRODUCT_SLUG, 'nanocoder');
	t.is(vars.PRODUCT_REPO, 'Nano-Collective/nanocoder');
	t.is(vars.PRODUCT_REPO_URL, 'https://github.com/Nano-Collective/nanocoder');
	t.is(vars.VERSION, '1.25.2');
	t.is(vars.REPO_PATH, '/tmp/repo');
	t.is(
		vars.RELEASE_TAG_URL,
		'https://github.com/Nano-Collective/nanocoder/releases/tag/v1.25.2',
	);
	t.regex(vars.RELEASE_BODY, /What changed/);
	t.is(vars.GENERATED_AT, '2026-05-01T10:00:00Z');
	t.is(vars.MODEL, 'minimax-m2.7');
	t.is(vars.PACK_DIR, '/tmp/pack');
	t.is(vars.PACK_ID, 'nanocoder/1.25.2');
	t.is(vars.VALIDATOR_ROOT, 'content/_local');
});

test('buildPromptVars: defaults missing release fields to empty string', t => {
	const vars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: {product: 'nanocoder', version: '1.25.2'},
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content',
	});
	t.is(vars.RELEASE_BODY, '');
	t.is(vars.RELEASE_TAG_URL, '');
});

test('buildPromptVars: includes channels.json content', t => {
	const vars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content',
	});
	t.true(vars.CHANNELS_JSON.length > 0);
	// Smoke check — the channels config should mention at least one known channel.
	t.regex(vars.CHANNELS_JSON, /linkedin|x|github-discussion/);
});

test('buildAgentPrompt: substitutes vars into the release-channels template', t => {
	const agent: AgentSpec = AGENTS[0];
	const vars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content/_local',
	});
	const prompt = buildAgentPrompt(agent, vars);
	t.regex(prompt, /nanocoder/);
	t.regex(prompt, /1\.25\.2/);
	t.notRegex(prompt, /\{\{PRODUCT_SLUG\}\}/);
	t.notRegex(prompt, /\{\{VERSION\}\}/);
});

test('buildAgentPrompt: substitutes vars into the article-channels template', t => {
	const agent: AgentSpec = AGENTS[1];
	const vars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content/_local',
	});
	const prompt = buildAgentPrompt(agent, vars);
	t.regex(prompt, /nanocoder/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
});

test('buildAutoFixPrompt: substitutes attempt counters and error report', t => {
	const prompt = buildAutoFixPrompt({
		originalPrompt: 'ORIGINAL_PROMPT_BODY',
		errorReport: '[{"rule":"max-chars","file":"channels/x.md"}]',
		packDir: '/tmp/pack',
		attemptNumber: 2,
		maxAttempts: 5,
	});
	t.regex(prompt, /max-chars/);
	t.regex(prompt, /\/tmp\/pack/);
	t.regex(prompt, /\bORIGINAL_PROMPT_BODY\b/);
	t.regex(prompt, /\b2\b[\s\S]*\b5\b/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{ATTEMPT_NUMBER\}\}/);
	t.notRegex(prompt, /\{\{MAX_ATTEMPTS\}\}/);
	t.notRegex(prompt, /\{\{ERROR_REPORT\}\}/);
	t.notRegex(prompt, /\{\{ORIGINAL_PROMPT\}\}/);
});
