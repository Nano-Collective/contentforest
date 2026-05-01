import test from 'ava';
import {
	buildAutoFixPrompt,
	buildPrompt,
	type JobSpec,
	type Product,
	scopeTarget,
	substitute,
} from './change-request.js';

const PRODUCT: Product = {slug: 'nanocoder', repo: 'Nano-Collective/nanocoder'};

const BASE_JOB: JobSpec = {
	product: 'nanocoder',
	version: '1.25.2',
	scope: 'channels',
	articleSlug: null,
	filePath: null,
	request: 'Tighten the LinkedIn post.',
	context: null,
	requester: 'will',
	issueNumber: 42,
};

test('substitute: replaces a single template variable', t => {
	t.is(substitute('hello {{NAME}}', {NAME: 'world'}), 'hello world');
});

test('substitute: replaces multiple variables in one pass', t => {
	t.is(substitute('{{A}}-{{B}}-{{A}}', {A: 'x', B: 'y'}), 'x-y-x');
});

test('substitute: leaves unknown placeholders intact', t => {
	t.is(
		substitute('hello {{NAME}} {{UNKNOWN}}', {NAME: 'will'}),
		'hello will {{UNKNOWN}}',
	);
});

test('substitute: handles multi-line templates', t => {
	t.is(
		substitute('line1: {{A}}\nline2: {{B}}', {A: '1', B: '2'}),
		'line1: 1\nline2: 2',
	);
});

test('substitute: replaces all occurrences of the same key', t => {
	t.is(substitute('{{X}}.{{X}}.{{X}}', {X: 'a'}), 'a.a.a');
});

test('substitute: empty vars map returns the template untouched', t => {
	t.is(substitute('hello {{X}}', {}), 'hello {{X}}');
});

test('scopeTarget: whole-pack returns the broad target', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'whole-pack'}),
		'any file under the pack root',
	);
});

test('scopeTarget: channels returns channels-only target', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'channels'}),
		'channels/*.md only — articles are off-limits',
	);
});

test('scopeTarget: article includes the article slug in the target', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'article', articleSlug: 'mcp-support'}),
		'articles/mcp-support/ only — headline channels and other articles are off-limits',
	);
});

test('scopeTarget: file includes the file path in the target', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'file', filePath: 'channels/x.md'}),
		'the single file at channels/x.md — nothing else',
	);
});

test('buildPrompt: substitutes core variables into the change-request template', t => {
	const prompt = buildPrompt({
		product: PRODUCT,
		job: BASE_JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
	});
	// Spot-check substituted values.
	t.regex(prompt, /nanocoder/);
	t.regex(prompt, /1\.25\.2/);
	t.regex(prompt, /Tighten the LinkedIn post\./);
	t.regex(prompt, /minimax-m2\.7/);
	// Verify the placeholders this function owns are resolved.
	t.notRegex(prompt, /\{\{PRODUCT_SLUG\}\}/);
	t.notRegex(prompt, /\{\{VERSION\}\}/);
	t.notRegex(prompt, /\{\{REQUEST\}\}/);
	t.notRegex(prompt, /\{\{SCOPE_TARGET\}\}/);
});

test('buildPrompt: includes the scope target derived from the job', t => {
	const prompt = buildPrompt({
		product: PRODUCT,
		job: {...BASE_JOB, scope: 'whole-pack'},
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /any file under the pack root/);
});

test('buildPrompt: handles missing optional fields with explicit "(none)"', t => {
	const prompt = buildPrompt({
		product: PRODUCT,
		job: BASE_JOB,
		packDir: '/tmp/pack',
		repoPath: '/tmp/repo',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m2.7',
	});
	t.regex(prompt, /\(none\)/);
});

test('buildAutoFixPrompt: substitutes attempt counters and error report', t => {
	const prompt = buildAutoFixPrompt({
		originalPrompt: 'ORIGINAL_PROMPT_BODY',
		errorReport: '[{"rule":"max-chars","file":"x.md"}]',
		packDir: '/tmp/pack',
		attemptNumber: 2,
		maxAttempts: 3,
	});
	// All values passed to buildAutoFixPrompt are substituted into the body.
	t.regex(prompt, /max-chars/);
	t.regex(prompt, /\/tmp\/pack/);
	t.regex(prompt, /\bORIGINAL_PROMPT_BODY\b/);
	t.regex(prompt, /\b2\b[\s\S]*\b3\b/);
	// Verify the placeholder strings the function is responsible for don't
	// leak through unsubstituted.
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{ATTEMPT_NUMBER\}\}/);
	t.notRegex(prompt, /\{\{MAX_ATTEMPTS\}\}/);
	t.notRegex(prompt, /\{\{ERROR_REPORT\}\}/);
	t.notRegex(prompt, /\{\{ORIGINAL_PROMPT\}\}/);
});
