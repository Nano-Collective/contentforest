import test from 'ava';
import {cn} from './utils.js';

test('cn: merges plain class strings', t => {
	t.is(cn('foo', 'bar'), 'foo bar');
});

test('cn: filters falsy values', t => {
	t.is(cn('foo', false, null, undefined, 'bar'), 'foo bar');
});

test('cn: dedupes conflicting Tailwind classes via twMerge', t => {
	// twMerge keeps the last conflicting utility — `p-2` wins over `p-1`.
	t.is(cn('p-1', 'p-2'), 'p-2');
});

test('cn: accepts conditional object syntax via clsx', t => {
	t.is(cn({foo: true, bar: false, baz: true}), 'foo baz');
});

test('cn: handles arrays of class values', t => {
	t.is(cn(['foo', 'bar'], 'baz'), 'foo bar baz');
});

test('cn: returns empty string for no inputs', t => {
	t.is(cn(), '');
});
