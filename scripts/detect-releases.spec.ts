import test from 'ava';
import {compareVersions} from './detect-releases.js';

test('compareVersions: equal versions → 0', t => {
	t.is(compareVersions('1.2.3', '1.2.3'), 0);
});

test('compareVersions: a > b at major', t => {
	t.true(compareVersions('2.0.0', '1.99.99') > 0);
});

test('compareVersions: a < b at minor', t => {
	t.true(compareVersions('1.2.0', '1.3.0') < 0);
});

test('compareVersions: a > b at patch', t => {
	t.true(compareVersions('1.2.4', '1.2.3') > 0);
});

test('compareVersions: shorter version compares as zero-padded', t => {
	t.is(compareVersions('1.2', '1.2.0'), 0);
	t.true(compareVersions('1.3', '1.2.99') > 0);
});

test('compareVersions: numeric segments — 10 > 9', t => {
	// Lexical comparison would put "9" > "10"; we want numeric.
	t.true(compareVersions('1.10.0', '1.9.0') > 0);
});

test('compareVersions: non-numeric segments parsed as 0', t => {
	t.is(compareVersions('1.x.0', '1.0.0'), 0);
});

test('compareVersions: handles leading-zero segments', t => {
	t.is(compareVersions('1.02.3', '1.2.3'), 0);
});
