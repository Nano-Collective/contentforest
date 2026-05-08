import test from 'ava';
import {
	buildJobSpec,
	extractFields,
	ParseError,
} from './parse-change-request.js';

const ISSUE_BODY = `### Target

nanocoder/1.25.2

### Scope

Headline channels (channels/*.md)

### File path

_No response_

### Request

Tighten the LinkedIn post — keep the lede.

### Additional context

_No response_
`;

test('extractFields: parses every known field from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	t.is(fields.get('Target'), 'nanocoder/1.25.2');
	t.is(fields.get('Scope'), 'Headline channels (channels/*.md)');
	t.is(fields.get('File path'), null);
	t.is(fields.get('Request'), 'Tighten the LinkedIn post — keep the lede.');
	t.is(fields.get('Additional context'), null);
});

test('extractFields: maps "_No response_" sentinel to null', t => {
	const fields = extractFields('### Target\n\n_No response_\n');
	t.is(fields.get('Target'), null);
});

test('extractFields: tolerates fields in any order', t => {
	const body =
		'### Scope\n\nHeadline channels (channels/*.md)\n\n### Target\n\nnanocoder/1.25.0\n\n### Request\n\ndo a thing\n';
	const fields = extractFields(body);
	t.is(fields.get('Target'), 'nanocoder/1.25.0');
	t.is(fields.get('Scope'), 'Headline channels (channels/*.md)');
	t.is(fields.get('Request'), 'do a thing');
});

test('extractFields: treats unknown ### headings as content of the current field', t => {
	// Regression: a user-pasted `### Subhead` inside the Request textarea
	// used to flush the Request buffer empty and fail with
	// `required field missing: "Request"`. The unknown heading must stay
	// part of the Request value.
	const body =
		'### Target\n\nnanocoder/1.25.2\n\n### Scope\n\nHeadline channels (channels/*.md)\n\n### File path\n\n_No response_\n\n### Request\n\n### User-pasted subhead\n\nbody copy here\n\n### Additional context\n\n_No response_\n';
	const fields = extractFields(body);
	t.is(fields.get('Target'), 'nanocoder/1.25.2');
	t.is(fields.get('Scope'), 'Headline channels (channels/*.md)');
	t.is(
		fields.get('Request'),
		'### User-pasted subhead\n\nbody copy here',
	);
	t.false(fields.has('User-pasted subhead'));
});

test('extractFields: matches headings case-insensitively', t => {
	const body = '### target\n\nnanocoder/1.25.0\n';
	const fields = extractFields(body);
	t.is(fields.get('Target'), 'nanocoder/1.25.0');
});

test('buildJobSpec: builds a complete spec from a pack-target channels request', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'will', issueNumber: 42});
	t.deepEqual(spec, {
		product: 'nanocoder',
		version: '1.25.2',
		scope: 'channels',
		articleSlug: null,
		filePath: null,
		request: 'Tighten the LinkedIn post — keep the lede.',
		context: null,
		requester: 'will',
		issueNumber: 42,
	});
});

test('buildJobSpec: derives articleSlug from an article-target Target', t => {
	const fields = extractFields(
		ISSUE_BODY.replace(
			'nanocoder/1.25.2',
			'nanocoder/1.25.2/articles/mcp-support',
		),
	);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.product, 'nanocoder');
	t.is(spec.version, '1.25.2');
	t.is(spec.articleSlug, 'mcp-support');
});

test('buildJobSpec: scope=Whole+article-target maps to scope=article', t => {
	const fields = extractFields(
		ISSUE_BODY.replace(
			'nanocoder/1.25.2',
			'nanocoder/1.25.2/articles/mcp-support',
		).replace('Headline channels (channels/*.md)', 'Whole pack / article'),
	);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.scope, 'article');
	t.is(spec.articleSlug, 'mcp-support');
});

test('buildJobSpec: scope=Whole+pack-target stays scope=whole-pack', t => {
	const fields = extractFields(
		ISSUE_BODY.replace(
			'Headline channels (channels/*.md)',
			'Whole pack / article',
		),
	);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.scope, 'whole-pack');
	t.is(spec.articleSlug, null);
});

test('buildJobSpec: maps each scope label to the enum', t => {
	const cases = [
		['Whole pack / article', 'whole-pack'],
		['Headline channels (channels/*.md)', 'channels'],
	] as const;
	for (const [label, expected] of cases) {
		const body = ISSUE_BODY.replace('Headline channels (channels/*.md)', label);
		const fields = extractFields(body);
		const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
		t.is(spec.scope, expected, `scope for ${label}`);
	}
});

test('buildJobSpec: scope=Specific file resolves correctly with file path', t => {
	const body = ISSUE_BODY.replace(
		'Headline channels (channels/*.md)',
		'Specific file',
	).replace('### File path\n\n_No response_', '### File path\n\nchannels/x.md');
	const fields = extractFields(body);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.scope, 'file');
	t.is(spec.filePath, 'channels/x.md');
});

test('buildJobSpec: rejects malformed Target', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('nanocoder/1.25.2', 'no-slash'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /<product>\/<version>/);
});

test('buildJobSpec: throws ParseError on missing Target', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('nanocoder/1.25.2', '_No response_'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Target/);
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
