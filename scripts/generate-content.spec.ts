import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'ava';
import {
	AGENTS,
	type AgentSpec,
	buildAgentPrompt,
	buildArticleWritePrompt,
	buildAutoFixPrompt,
	buildPromptVars,
	type JobSpec,
	type Product,
	packDirFor,
	parsePlan,
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

test('AGENTS: pipeline is release-channels → article-plan → article-write', t => {
	t.deepEqual(
		AGENTS.map(a => a.slug),
		['release-channels', 'article-plan', 'article-write'],
	);
	t.is(AGENTS[0].phase, 'channels');
	t.is(AGENTS[1].phase, 'articles');
	t.is(AGENTS[2].phase, 'articles');
	t.true(AGENTS[0].promptFile.endsWith('release-channels.md'));
	t.true(AGENTS[1].promptFile.endsWith('article-plan.md'));
	t.true(AGENTS[2].promptFile.endsWith('article-write.md'));
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

test('buildAgentPrompt: substitutes vars into the article-plan template', t => {
	const planner = AGENTS.find(a => a.slug === 'article-plan');
	t.truthy(planner, 'article-plan agent should exist in AGENTS');
	const vars = {
		...buildPromptVars({
			product: PRODUCT,
			version: '1.25.2',
			job: JOB,
			packDir: '/tmp/pack',
			repoPath: '/tmp/repo',
			generatedAt: '2026-05-01T10:00:00Z',
			model: 'minimax-m2.7',
			validatorRoot: 'content/_local',
		}),
		PLAN_OUTPUT_PATH: '/tmp/cf-plan-test.json',
	};
	const prompt = buildAgentPrompt(planner, vars);
	t.regex(prompt, /nanocoder/);
	t.regex(prompt, /\/tmp\/cf-plan-test\.json/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{PLAN_OUTPUT_PATH\}\}/);
});

test('buildArticleWritePrompt: substitutes per-article vars on top of shared vars', t => {
	const writer = AGENTS.find(a => a.slug === 'article-write');
	t.truthy(writer, 'article-write agent should exist in AGENTS');
	const promptVars = buildPromptVars({
		product: PRODUCT,
		version: '1.25.2',
		job: JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
		validatorRoot: 'content/_local',
	});
	// Read the writer template the same way the orchestrator does.
	const template = readFileSync(
		join(process.cwd(), 'prompts', writer.promptFile),
		'utf8',
	);
	const prompt = buildArticleWritePrompt({
		template,
		promptVars,
		article: {
			slug: 'mcp-support',
			title: 'How MCP support works in nanocoder',
			focus: 'The wiring of MCP clients into the existing tool loop.',
		},
	});
	t.regex(prompt, /mcp-support/);
	t.regex(prompt, /How MCP support works in nanocoder/);
	t.regex(prompt, /MCP clients/);
	t.notRegex(prompt, /\{\{ARTICLE_SLUG\}\}/);
	t.notRegex(prompt, /\{\{ARTICLE_TITLE\}\}/);
	t.notRegex(prompt, /\{\{ARTICLE_FOCUS\}\}/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
});

test('parsePlan: accepts empty array (zero articles is a valid plan)', t => {
	const out = parsePlan('[]');
	t.true(out.ok);
	if (out.ok) t.deepEqual(out.plan, []);
});

test('parsePlan: accepts a well-shaped one-article plan', t => {
	const out = parsePlan(
		JSON.stringify([
			{slug: 'mcp-support', title: 'Title', focus: 'Focus line.'},
		]),
	);
	t.true(out.ok);
	if (out.ok) {
		t.is(out.plan.length, 1);
		t.is(out.plan[0].slug, 'mcp-support');
	}
});

test('parsePlan: rejects non-JSON', t => {
	const out = parsePlan('not json');
	t.false(out.ok);
	if (!out.ok) t.regex(out.problems[0], /not valid JSON/);
});

test('parsePlan: rejects non-array root', t => {
	const out = parsePlan('{}');
	t.false(out.ok);
	if (!out.ok) t.regex(out.problems[0], /must be a JSON array/);
});

test('parsePlan: rejects plan with > 3 entries', t => {
	const entries = ['a', 'b', 'c', 'd'].map(s => ({
		slug: s,
		title: 'T',
		focus: 'F',
	}));
	const out = parsePlan(JSON.stringify(entries));
	t.false(out.ok);
	if (!out.ok) t.true(out.problems.some(p => /cap is 3/.test(p)));
});

test('parsePlan: rejects non-kebab slug', t => {
	const out = parsePlan(
		JSON.stringify([{slug: 'Bad_Slug', title: 'T', focus: 'F'}]),
	);
	t.false(out.ok);
	if (!out.ok) t.true(out.problems.some(p => /kebab-case/.test(p)));
});

test('parsePlan: rejects duplicate slugs', t => {
	const out = parsePlan(
		JSON.stringify([
			{slug: 'dup', title: 'T1', focus: 'F1'},
			{slug: 'dup', title: 'T2', focus: 'F2'},
		]),
	);
	t.false(out.ok);
	if (!out.ok) t.true(out.problems.some(p => /duplicated/.test(p)));
});

test('parsePlan: rejects missing fields', t => {
	const out = parsePlan(JSON.stringify([{slug: 'ok', title: 'T'}]));
	t.false(out.ok);
	if (!out.ok) t.true(out.problems.some(p => /focus/.test(p)));
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
