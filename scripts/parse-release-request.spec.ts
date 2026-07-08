import test from 'ava';
import {
	buildJobSpec,
	extractFields,
	ParseError,
} from './parse-release-request.js';

const ISSUE_BODY = `### Product

nanocoder

### Version

1.28.0

### Additional context

_No response_
`;

test('extractFields: parses every known field from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	t.is(fields.get('Product'), 'nanocoder');
	t.is(fields.get('Version'), '1.28.0');
	t.is(fields.get('Additional context'), null);
});

test('extractFields: maps "_No response_" sentinel to null', t => {
	const fields = extractFields('### Additional context\n\n_No response_\n');
	t.is(fields.get('Additional context'), null);
});

test('extractFields: tolerates fields in any order', t => {
	const body = '### Version\n\n1.28.0\n\n### Product\n\nget-md\n';
	const fields = extractFields(body);
	t.is(fields.get('Product'), 'get-md');
	t.is(fields.get('Version'), '1.28.0');
});

test('extractFields: treats unknown ### headings as content of the current field', t => {
	const body =
		'### Product\n\nnanocoder\n\n### Version\n\n1.28.0\n\n### Additional context\n\n### Pasted subhead\n\nbody copy here\n';
	const fields = extractFields(body);
	t.is(
		fields.get('Additional context'),
		'### Pasted subhead\n\nbody copy here',
	);
	t.false(fields.has('Pasted subhead'));
});

test('extractFields: matches headings case-insensitively', t => {
	const body = '### product\n\nnanocoder\n';
	const fields = extractFields(body);
	t.is(fields.get('Product'), 'nanocoder');
});

test('buildJobSpec: builds a complete spec from a well-formed body', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'will', issueNumber: 42});
	t.deepEqual(spec, {
		product: 'nanocoder',
		version: '1.28.0',
		context: null,
		requester: 'will',
		issueNumber: 42,
	});
});

test('buildJobSpec: carries Additional context through', t => {
	const fields = extractFields(
		ISSUE_BODY.replace(
			'### Additional context\n\n_No response_',
			'### Additional context\n\nLead on the ACP integration.',
		),
	);
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.context, 'Lead on the ACP integration.');
});

test('buildJobSpec: strips a pasted "v" prefix from the version', t => {
	const fields = extractFields(ISSUE_BODY.replace('1.28.0', 'v1.28.0'));
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.version, '1.28.0');
});

test('buildJobSpec: accepts a pre-release version', t => {
	const fields = extractFields(ISSUE_BODY.replace('1.28.0', '1.28.0-beta.1'));
	const spec = buildJobSpec({fields, requester: 'w', issueNumber: 1});
	t.is(spec.version, '1.28.0-beta.1');
});

test('buildJobSpec: throws ParseError on missing Product', t => {
	const fields = extractFields(
		ISSUE_BODY.replace('nanocoder', '_No response_'),
	);
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Product/);
});

test('buildJobSpec: rejects a non-kebab Product slug', t => {
	const fields = extractFields(ISSUE_BODY.replace('nanocoder', 'Nano Coder'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /kebab-case/);
});

test('buildJobSpec: throws ParseError on missing Version', t => {
	const fields = extractFields(ISSUE_BODY.replace('1.28.0', '_No response_'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Version/);
});

test('buildJobSpec: rejects a version with a slash', t => {
	const fields = extractFields(ISSUE_BODY.replace('1.28.0', '1.28/0'));
	const err = t.throws(
		() => buildJobSpec({fields, requester: 'w', issueNumber: 1}),
		{instanceOf: ParseError},
	);
	t.regex(err.message, /Version/);
});

test('buildJobSpec: passes through requester and issueNumber', t => {
	const fields = extractFields(ISSUE_BODY);
	const spec = buildJobSpec({fields, requester: 'alice', issueNumber: 999});
	t.is(spec.requester, 'alice');
	t.is(spec.issueNumber, 999);
});
