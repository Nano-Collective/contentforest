/**
 * Tests for the pure pieces of the x-daily orchestrator: slot construction,
 * plan parsing/validation, ledger reading + recent-angle summarisation, and
 * the content-root mapping. The I/O orchestration in main() (nanocoder spawns,
 * validator spawns, file writes) is excluded from coverage via c8 ignore and
 * exercised end-to-end by the workflow.
 */

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	buildSlots,
	contentRootFor,
	type LedgerEntry,
	parseXDailyPlan,
	readLedger,
	type Slot,
	substitute,
	summarizeRecentAngles,
} from './x-daily.js';

const PRODUCTS = [
	{slug: 'nanocoder', repo: 'Nano-Collective/nanocoder'},
	{slug: 'get-md', repo: 'Nano-Collective/get-md'},
];

test('substitute: replaces all occurrences of a key', t => {
	t.is(substitute('{{X}}-{{X}}', {X: 'a'}), 'a-a');
});

test('contentRootFor: maps each mode to its content root', t => {
	t.is(contentRootFor('commit'), 'content');
	t.is(contentRootFor('test'), 'content/_test');
	t.is(contentRootFor('local'), 'content/_local');
});

test('buildSlots: one product slot each plus N collective slots', t => {
	const slots = buildSlots(PRODUCTS, 2);
	t.deepEqual(slots, [
		{file: 'nanocoder.md', source: 'nanocoder', sourceKind: 'product'},
		{file: 'get-md.md', source: 'get-md', sourceKind: 'product'},
		{file: 'collective-1.md', source: 'collective', sourceKind: 'collective'},
		{file: 'collective-2.md', source: 'collective', sourceKind: 'collective'},
	]);
});

test('buildSlots: zero collective slots yields only product slots', t => {
	const slots = buildSlots(PRODUCTS, 0);
	t.is(slots.length, 2);
	t.false(slots.some(s => s.sourceKind === 'collective'));
});

const SLOTS: Slot[] = buildSlots(PRODUCTS, 1);

function validPlanJson(): string {
	return JSON.stringify([
		{file: 'nanocoder.md', angle: 'mcp support', focus: 'Explain MCP.'},
		{file: 'get-md.md', angle: 'url to markdown', focus: 'One-shot fetch.'},
		{
			file: 'collective-1.md',
			angle: 'how we ship',
			focus: 'Community model.',
		},
	]);
}

test('parseXDailyPlan: accepts a plan covering every slot exactly once', t => {
	const result = parseXDailyPlan(validPlanJson(), SLOTS);
	t.true(result.ok);
	if (result.ok) {
		// Re-ordered to slot order.
		t.deepEqual(
			result.plan.map(p => p.file),
			['nanocoder.md', 'get-md.md', 'collective-1.md'],
		);
	}
});

test('parseXDailyPlan: rejects non-JSON', t => {
	const result = parseXDailyPlan('not json', SLOTS);
	t.false(result.ok);
});

test('parseXDailyPlan: rejects a non-array', t => {
	const result = parseXDailyPlan('{"file":"x"}', SLOTS);
	t.false(result.ok);
	if (!result.ok) t.true(result.problems.some(p => p.includes('array')));
});

test('parseXDailyPlan: flags a missing slot', t => {
	const plan = JSON.stringify([
		{file: 'nanocoder.md', angle: 'a', focus: 'f'},
		{file: 'get-md.md', angle: 'a', focus: 'f'},
	]);
	const result = parseXDailyPlan(plan, SLOTS);
	t.false(result.ok);
	if (!result.ok) {
		t.true(
			result.problems.some(p => p.includes('missing slot "collective-1.md"')),
		);
	}
});

test('parseXDailyPlan: flags an unexpected slot', t => {
	const plan = JSON.parse(validPlanJson());
	plan.push({file: 'stray.md', angle: 'a', focus: 'f'});
	const result = parseXDailyPlan(JSON.stringify(plan), SLOTS);
	t.false(result.ok);
	if (!result.ok) {
		t.true(result.problems.some(p => p.includes('unexpected slot "stray.md"')));
	}
});

test('parseXDailyPlan: flags a duplicate slot', t => {
	const plan = JSON.parse(validPlanJson());
	plan.push({file: 'nanocoder.md', angle: 'dup', focus: 'f'});
	const result = parseXDailyPlan(JSON.stringify(plan), SLOTS);
	t.false(result.ok);
	if (!result.ok) {
		t.true(result.problems.some(p => p.includes('duplicated')));
	}
});

test('parseXDailyPlan: flags an empty angle', t => {
	const plan = JSON.parse(validPlanJson());
	plan[0].angle = '';
	const result = parseXDailyPlan(JSON.stringify(plan), SLOTS);
	t.false(result.ok);
	if (!result.ok) t.true(result.problems.some(p => p.includes('angle')));
});

const LEDGER: LedgerEntry[] = [
	{date: '2026-06-01', source: 'nanocoder', angle: 'old angle', preview: ''},
	{date: '2026-06-08', source: 'nanocoder', angle: 'recent angle', preview: ''},
	{date: '2026-06-08', source: 'collective', angle: 'how we ship', preview: ''},
];

test('summarizeRecentAngles: groups by source, newest first', t => {
	const summary = summarizeRecentAngles(LEDGER, SLOTS);
	t.true(summary.includes('nanocoder:'));
	// newest first
	t.true(summary.indexOf('recent angle') < summary.indexOf('old angle'));
	// a source with no history is labelled
	t.true(summary.includes('get-md: (no recent posts)'));
});

test('summarizeRecentAngles: caps entries per source', t => {
	const many: LedgerEntry[] = Array.from({length: 12}, (_, i) => ({
		date: '2026-06-01',
		source: 'nanocoder',
		angle: `angle-${i}`,
		preview: '',
	}));
	const summary = summarizeRecentAngles(many, SLOTS, 3);
	const shown = summary
		.split('\n')
		.filter(l => l.trim().startsWith('- ')).length;
	// 3 for nanocoder + the "(no recent posts)" lines aren't bullet points
	t.is(shown, 3);
});

test('readLedger: returns [] when the file is missing', t => {
	t.deepEqual(readLedger(join(tmpdir(), 'does-not-exist-xyz.json')), []);
});

test('readLedger: reads a committed ledger array', t => {
	const dir = mkdtempSync(join(tmpdir(), 'cf-x-daily-ledger-'));
	try {
		const p = join(dir, 'ledger.json');
		writeFileSync(p, JSON.stringify(LEDGER));
		t.deepEqual(readLedger(p), LEDGER);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});

test('readLedger: tolerates a corrupt ledger', t => {
	const dir = mkdtempSync(join(tmpdir(), 'cf-x-daily-ledger-'));
	try {
		const p = join(dir, 'ledger.json');
		writeFileSync(p, '{not json');
		t.deepEqual(readLedger(p), []);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});
