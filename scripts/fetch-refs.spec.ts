import test from 'ava';
import {extractDocUrls, localPathFor} from './fetch-refs.js';

const BASE = 'https://docs.nanocollective.org';

test('extractDocUrls: pulls markdown-link URLs from llms.txt', t => {
	const body = `
- [Introduction](https://docs.nanocollective.org/collective.md): An introduction
- [Projects](https://docs.nanocollective.org/collective/projects.md): Projects
`;
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/collective.md',
		'https://docs.nanocollective.org/collective/projects.md',
	]);
});

test('extractDocUrls: pulls bare URLs from llms.txt', t => {
	const body = 'See https://docs.nanocollective.org/foo.md for details.';
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/foo.md',
	]);
});

test('extractDocUrls: dedupes URLs that appear multiple times', t => {
	const body = `
[a](https://docs.nanocollective.org/foo.md)
also see https://docs.nanocollective.org/foo.md
`;
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/foo.md',
	]);
});

test('extractDocUrls: filters out off-host URLs', t => {
	const body = `
- [docs](https://docs.nanocollective.org/foo.md)
- [github](https://github.com/Nano-Collective/contentforest/blob/main/README.md)
`;
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/foo.md',
	]);
});

test('extractDocUrls: filters out non-md/non-txt URLs', t => {
	const body = `
- [docs](https://docs.nanocollective.org/foo.md)
- [page](https://docs.nanocollective.org/page)
- [json](https://docs.nanocollective.org/data.json)
- [txt](https://docs.nanocollective.org/notes.txt)
`;
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/foo.md',
		'https://docs.nanocollective.org/notes.txt',
	]);
});

test('extractDocUrls: resolves relative URLs against the base', t => {
	const body = '[rel](/collective/projects.md)';
	t.deepEqual(extractDocUrls(body, BASE), [
		'https://docs.nanocollective.org/collective/projects.md',
	]);
});

test('extractDocUrls: ignores malformed URLs gracefully', t => {
	const body = '[broken](http://[bogus)';
	t.deepEqual(extractDocUrls(body, BASE), []);
});

test('extractDocUrls: empty body returns empty array', t => {
	t.deepEqual(extractDocUrls('', BASE), []);
});

test('localPathFor: maps URL pathname under the refs dir', t => {
	const path = localPathFor(
		'https://docs.nanocollective.org/collective/projects.md',
		'/tmp/refs',
	);
	t.is(path, '/tmp/refs/collective/projects.md');
});

test('localPathFor: maps a bare-host URL to index.md', t => {
	const path = localPathFor('https://docs.nanocollective.org/', '/tmp/refs');
	t.is(path, '/tmp/refs/index.md');
});

test('localPathFor: strips leading slash from pathname', t => {
	const path = localPathFor(
		'https://docs.nanocollective.org/llms.txt',
		'/refs',
	);
	t.is(path, '/refs/llms.txt');
});
