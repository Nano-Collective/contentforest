import test from 'ava';
import {
	buildAutoFixPrompt,
	buildPrompt,
	type JobSpec,
	scopeTarget,
	substitute,
} from './collective-request.js';

const BASE_JOB: JobSpec = {
	slug: 'economics-charter-explainer',
	scope: 'channels',
	filePath: null,
	request: 'Tighten the LinkedIn post about the economics charter.',
	context: null,
	requester: 'will',
	issueNumber: 42,
};

test('substitute: replaces a single template variable', t => {
	t.is(substitute('hello {{NAME}}', {NAME: 'world'}), 'hello world');
});

test('substitute: leaves unknown placeholders intact', t => {
	t.is(
		substitute('hello {{NAME}} {{UNKNOWN}}', {NAME: 'will'}),
		'hello will {{UNKNOWN}}',
	);
});

test('substitute: replaces all occurrences of the same key', t => {
	t.is(substitute('{{X}}.{{X}}.{{X}}', {X: 'a'}), 'a.a.a');
});

test('scopeTarget: whole-pack in create mode covers full pack', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'whole-pack'}, 'create'),
		'every channel file plus meta.json — generate the full pack',
	);
});

test('scopeTarget: whole-pack in edit mode is permissive', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'whole-pack'}, 'edit'),
		'any file under the pack root',
	);
});

test('scopeTarget: channels returns channels-only target', t => {
	t.is(
		scopeTarget({...BASE_JOB, scope: 'channels'}, 'edit'),
		'channels/*.md only',
	);
});

test('scopeTarget: file includes the file path in the target', t => {
	t.is(
		scopeTarget(
			{...BASE_JOB, scope: 'file', filePath: 'channels/x.md'},
			'edit',
		),
		'the single file at channels/x.md — nothing else',
	);
});

test('buildPrompt: substitutes core variables into the collective-request template', t => {
	const prompt = buildPrompt({
		job: BASE_JOB,
		mode: 'edit',
		packDir: '/tmp/pack',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m3',
	});
	t.regex(prompt, /economics-charter-explainer/);
	t.regex(prompt, /Tighten the LinkedIn post about the economics charter\./);
	t.regex(prompt, /minimax-m3/);
	t.regex(prompt, /https:\/\/nanocollective\.org/);
	t.notRegex(prompt, /\{\{SLUG\}\}/);
	t.notRegex(prompt, /\{\{REQUEST\}\}/);
	t.notRegex(prompt, /\{\{SCOPE_TARGET\}\}/);
	t.notRegex(prompt, /\{\{COLLECTIVE_URL\}\}/);
	t.notRegex(prompt, /\{\{MODE\}\}/);
});

test('buildPrompt: emits the create-mode scope target when mode=create', t => {
	const prompt = buildPrompt({
		job: {...BASE_JOB, scope: 'whole-pack'},
		mode: 'create',
		packDir: '/tmp/pack',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m3',
	});
	t.regex(prompt, /generate the full pack/);
});

test('buildPrompt: handles missing optional fields with explicit "(none)"', t => {
	const prompt = buildPrompt({
		job: BASE_JOB,
		mode: 'edit',
		packDir: '/tmp/pack',
		generatedAt: '2026-05-01T10:00:00Z',
		model: 'minimax-m3',
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
	t.regex(prompt, /max-chars/);
	t.regex(prompt, /\/tmp\/pack/);
	t.regex(prompt, /\bORIGINAL_PROMPT_BODY\b/);
	t.regex(prompt, /\b2\b[\s\S]*\b3\b/);
	t.notRegex(prompt, /\{\{PACK_DIR\}\}/);
	t.notRegex(prompt, /\{\{ATTEMPT_NUMBER\}\}/);
	t.notRegex(prompt, /\{\{MAX_ATTEMPTS\}\}/);
	t.notRegex(prompt, /\{\{ERROR_REPORT\}\}/);
	t.notRegex(prompt, /\{\{ORIGINAL_PROMPT\}\}/);
});
