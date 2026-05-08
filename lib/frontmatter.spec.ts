import test from 'ava';
import {getFrontmatterField, setFrontmatterField} from './frontmatter.js';

const SAMPLE = `---
product: nanocoder
version: "1.25.0"
channel: linkedin
generated_at: "2026-05-01T16:23:25.085Z"
---

Body text here.
`;

test('setFrontmatterField replaces an existing key in place', t => {
	const out = setFrontmatterField(SAMPLE, 'channel', 'x');
	t.true(out.includes('channel: "x"'));
	t.false(out.includes('channel: linkedin'));
	t.true(out.endsWith('Body text here.\n'));
});

test('setFrontmatterField appends a new key when missing', t => {
	const out = setFrontmatterField(
		SAMPLE,
		'distributed_at',
		'2026-05-08T10:00:00.000Z',
	);
	t.true(out.includes('distributed_at: "2026-05-08T10:00:00.000Z"'));
	// Original keys preserved
	t.true(out.includes('product: nanocoder'));
	t.true(out.includes('channel: linkedin'));
	// Body untouched
	t.true(out.endsWith('Body text here.\n'));
});

test('setFrontmatterField is idempotent on overwrite', t => {
	const a = setFrontmatterField(
		SAMPLE,
		'distributed_at',
		'2026-05-08T10:00:00.000Z',
	);
	const b = setFrontmatterField(
		a,
		'distributed_at',
		'2026-05-08T10:00:00.000Z',
	);
	t.is(a, b);
});

test('setFrontmatterField inserts a frontmatter block when none exists', t => {
	const raw = '# Just a heading\n';
	const out = setFrontmatterField(
		raw,
		'distributed_at',
		'2026-05-08T10:00:00.000Z',
	);
	t.true(
		out.startsWith('---\ndistributed_at: "2026-05-08T10:00:00.000Z"\n---\n'),
	);
	t.true(out.includes('# Just a heading'));
});

test('getFrontmatterField reads a quoted value', t => {
	t.is(getFrontmatterField(SAMPLE, 'generated_at'), '2026-05-01T16:23:25.085Z');
});

test('getFrontmatterField reads an unquoted value', t => {
	t.is(getFrontmatterField(SAMPLE, 'product'), 'nanocoder');
});

test('getFrontmatterField returns null for missing keys', t => {
	t.is(getFrontmatterField(SAMPLE, 'distributed_at'), null);
});

test('getFrontmatterField returns null when no frontmatter block', t => {
	t.is(getFrontmatterField('# heading\n', 'product'), null);
});

test('does not match key prefixes — channel vs channel_extra', t => {
	const raw = `---
channel_extra: foo
---

body
`;
	t.is(getFrontmatterField(raw, 'channel'), null);
	const out = setFrontmatterField(raw, 'channel', 'linkedin');
	t.true(out.includes('channel_extra: foo'));
	t.true(out.includes('channel: "linkedin"'));
});
