import test from 'ava';
import {
	buildJobSpec,
	extractFields,
	ParseError,
} from './parse-personal-request.js';

const ISSUE_BODY = `### Member

will

### Base pack

nanocoder/1.25.0

### Additional context

_No response_
`;

test('extractFields: parses every known field from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	t.is(fields.get('Member'), 'will');
	t.is(fields.get('Base pack'), 'nanocoder/1.25.0');
	t.is(fields.get('Additional context'), null);
});

test('extractFields: maps "_No response_" sentinel to null', t => {
	const fields = extractFields('### Member\n\n_No response_\n');
	t.is(fields.get('Member'), null);
});

test('extractFields: treats unknown ### headings as content of the current field', t => {
	// Sister regression to the collective/change-request fix: a user-pasted
	// `### Subhead` inside Additional context must not eat the surrounding
	// value or null-out the previous field.
	const body =
		'### Member\n\nwill\n\n### Base pack\n\nnanocoder/1.25.0\n\n### Additional context\n\n### User-pasted subhead\n\nbody copy here\n';
	const fields = extractFields(body);
	t.is(fields.get('Member'), 'will');
	t.is(fields.get('Base pack'), 'nanocoder/1.25.0');
	t.is(
		fields.get('Additional context'),
		'### User-pasted subhead\n\nbody copy here',
	);
	t.false(fields.has('User-pasted subhead'));
});

test('buildJobSpec: builds spec for a product release request', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'will', issueNumber: 42});
	t.deepEqual(spec, {
		memberSlug: 'will',
		basePackKind: 'product',
		basePackId: 'nanocoder/1.25.0',
		context: null,
		requester: 'will',
		issueNumber: 42,
	});
});

test('buildJobSpec: builds spec for a collective pack request', t => {
	const body = ISSUE_BODY.replace(
		'nanocoder/1.25.0',
		'_collective/contentforest-launch',
	);
	const fields = extractFields(body);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.basePackKind, 'collective');
	// `_collective/` prefix stripped — orchestrator gets the bare slug.
	t.is(spec.basePackId, 'contentforest-launch');
});

test('buildJobSpec: lowercases member slug', t => {
	const fields = extractFields(ISSUE_BODY.replace('will', 'Will'));
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.memberSlug, 'will');
});

test('buildJobSpec: rejects non-kebab member slug', t => {
	const fields = extractFields(ISSUE_BODY.replace('will', 'Has Space!'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /kebab-case/);
});

test('buildJobSpec: rejects malformed product pack', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('nanocoder/1.25.0', 'no-slash'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /<product>\/<version>/);
});

test('buildJobSpec: rejects malformed collective slug after the prefix', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('nanocoder/1.25.0', '_collective/Has Space!'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /kebab-case/);
});

test('buildJobSpec: throws ParseError on missing required field', t => {
	const fields = extractFields(ISSUE_BODY.replace('will', '_No response_'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Member/);
});

test('buildJobSpec: passes through requester and issueNumber', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'alice', issueNumber: 999});
	t.is(spec.requester, 'alice');
	t.is(spec.issueNumber, 999);
});
