import test from 'ava';
import {
	buildJobSpec,
	extractFields,
	ParseError,
} from './parse-collective-request.js';

const ISSUE_BODY = `### Slug

economics-charter-explainer

### Scope

Headline channels (channels/*.md)

### File path

_No response_

### Request

Write a LinkedIn post explaining why we built the economics charter.

### Additional context

_No response_
`;

test('extractFields: parses every known field from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	t.is(fields.get('Slug'), 'economics-charter-explainer');
	t.is(fields.get('Scope'), 'Headline channels (channels/*.md)');
	t.is(fields.get('File path'), null);
	t.is(
		fields.get('Request'),
		'Write a LinkedIn post explaining why we built the economics charter.',
	);
	t.is(fields.get('Additional context'), null);
});

test('extractFields: maps "_No response_" sentinel to null', t => {
	const fields = extractFields('### Slug\n\n_No response_\n');
	t.is(fields.get('Slug'), null);
});

test('extractFields: tolerates fields in any order', t => {
	const body =
		'### Scope\n\nWhole pack\n\n### Slug\n\nhello\n\n### Request\n\ndo a thing\n';
	const fields = extractFields(body);
	t.is(fields.get('Slug'), 'hello');
	t.is(fields.get('Scope'), 'Whole pack');
	t.is(fields.get('Request'), 'do a thing');
});

test('extractFields: treats unknown ### headings as content of the current field', t => {
	// Regression: an issue body with a user-pasted `### Subhead` inside the
	// Request textarea used to flush the Request buffer empty and fail with
	// `required field missing: "Request"`. The unknown heading must stay
	// part of the Request value.
	const body =
		'### Slug\n\nhello\n\n### Scope\n\nSpecific file\n\n### File path\n\nchannels/x.md\n\n### Request\n\n### User-pasted subhead\n\nbody copy here\n\n### Additional context\n\n_No response_\n';
	const fields = extractFields(body);
	t.is(fields.get('Slug'), 'hello');
	t.is(fields.get('Scope'), 'Specific file');
	t.is(fields.get('Request'), '### User-pasted subhead\n\nbody copy here');
	t.is(fields.get('Additional context'), null);
	t.false(fields.has('User-pasted subhead'));
});

test('buildJobSpec: builds a complete spec from a channels-scope request', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'will', issueNumber: 42});
	t.deepEqual(spec, {
		slug: 'economics-charter-explainer',
		scope: 'channels',
		filePath: null,
		request:
			'Write a LinkedIn post explaining why we built the economics charter.',
		context: null,
		requester: 'will',
		issueNumber: 42,
	});
});

test('buildJobSpec: lowercases slug', t => {
	const fields = extractFields(
		ISSUE_BODY.replace(
			'economics-charter-explainer',
			'Economics-Charter-Explainer',
		),
	);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.slug, 'economics-charter-explainer');
});

test('buildJobSpec: rejects non-kebab slugs', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('economics-charter-explainer', 'Has Spaces!'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /kebab-case/);
});

test('buildJobSpec: maps each scope label to the enum', t => {
	const cases = [
		['Whole pack', 'whole-pack'],
		['Headline channels (channels/*.md)', 'channels'],
		['Specific file', 'file'],
	] as const;
	for (const [label, expected] of cases) {
		const body = ISSUE_BODY.replace('Headline channels (channels/*.md)', label);
		const withFile =
			label === 'Specific file'
				? body.replace(
						'### File path\n\n_No response_',
						'### File path\n\nchannels/x.md',
					)
				: body;
		const fields = extractFields(withFile);
		const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
		t.is(spec.scope, expected, `scope for ${label}`);
	}
});

test('buildJobSpec: throws ParseError on missing required field', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('economics-charter-explainer', '_No response_'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Slug/);
});

test('buildJobSpec: throws ParseError on unknown scope', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('Headline channels (channels/*.md)', 'Bogus scope'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /unknown scope/i);
});

test('buildJobSpec: requires File path when scope = file', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('Headline channels (channels/*.md)', 'Specific file'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /File path/);
});

test('buildJobSpec: passes through requester and issueNumber', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'alice', issueNumber: 999});
	t.is(spec.requester, 'alice');
	t.is(spec.issueNumber, 999);
});
