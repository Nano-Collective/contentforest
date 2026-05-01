import test from 'ava';
import {
	buildJobSpec,
	extractFields,
	ParseError,
} from './parse-change-request.js';

const ISSUE_BODY = `### Product

nanocoder

### Version

1.25.2

### Scope

Headline channels (channels/*.md)

### Article slug

_No response_

### File path

_No response_

### Request

Tighten the LinkedIn post — keep the lede.

### Additional context

_No response_
`;

test('extractFields: parses every known field from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	t.is(fields.get('Product'), 'nanocoder');
	t.is(fields.get('Version'), '1.25.2');
	t.is(fields.get('Scope'), 'Headline channels (channels/*.md)');
	t.is(fields.get('Article slug'), null);
	t.is(fields.get('File path'), null);
	t.is(fields.get('Request'), 'Tighten the LinkedIn post — keep the lede.');
	t.is(fields.get('Additional context'), null);
});

test('extractFields: maps "_No response_" sentinel to null', t => {
	const fields = extractFields('### Product\n\n_No response_\n');
	t.is(fields.get('Product'), null);
});

test('extractFields: maps empty body to null', t => {
	const fields = extractFields('### Product\n\n\n### Version\n\n1.0.0\n');
	t.is(fields.get('Product'), null);
	t.is(fields.get('Version'), '1.0.0');
});

test('extractFields: tolerates fields in any order', t => {
	const body = '### Version\n\n2.0.0\n\n### Product\n\nnanotune\n';
	const fields = extractFields(body);
	t.is(fields.get('Product'), 'nanotune');
	t.is(fields.get('Version'), '2.0.0');
});

test('extractFields: ignores unknown headings', t => {
	const body =
		'### Product\n\nnanocoder\n\n### Random Heading\n\nignored\n\n### Version\n\n1.0.0\n';
	const fields = extractFields(body);
	t.is(fields.get('Product'), 'nanocoder');
	t.is(fields.get('Version'), '1.0.0');
	t.false(fields.has('Random Heading'));
});

test('extractFields: matches headings case-insensitively', t => {
	const body = '### product\n\nnanocoder\n';
	const fields = extractFields(body);
	t.is(fields.get('Product'), 'nanocoder');
});

test('buildJobSpec: builds a complete spec from a channels-scope request', t => {
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

test('buildJobSpec: lowercases product slug', t => {
	const fields = extractFields(ISSUE_BODY.replace('nanocoder', 'NanoCoder'));
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.product, 'nanocoder');
});

test('buildJobSpec: maps each scope label to the enum', t => {
	const cases = [
		['Whole pack', 'whole-pack'],
		['Headline channels (channels/*.md)', 'channels'],
		['Specific article', 'article'],
		['Specific file', 'file'],
	] as const;
	for (const [label, expected] of cases) {
		const body = ISSUE_BODY.replace(
			'Headline channels (channels/*.md)',
			label,
		).replace(
			'_No response_\n\n### File path',
			label === 'Specific article'
				? 'mcp-support\n\n### File path'
				: '_No response_\n\n### File path',
		);
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
	const fields = extractFields(ISSUE_BODY.replace('1.25.2', '_No response_'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Version/);
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

test('buildJobSpec: requires Article slug when scope = article', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('Headline channels (channels/*.md)', 'Specific article'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Article slug/);
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
