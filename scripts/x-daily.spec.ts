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
	ARCHETYPES,
	archetypeById,
	archetypesCatalogue,
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

test('buildSlots: round-robins sources and numbers per source', t => {
	// 2 products + collective = 3 sources; 7 slots wraps twice.
	const slots = buildSlots(PRODUCTS, 7);
	t.deepEqual(
		slots.map(s => s.file),
		[
			'nanocoder-1.md',
			'get-md-1.md',
			'collective-1.md',
			'nanocoder-2.md',
			'get-md-2.md',
			'collective-2.md',
			'nanocoder-3.md',
		],
	);
	t.is(slots[2].sourceKind, 'collective');
	t.is(slots[0].sourceKind, 'product');
});

test('buildSlots: every product gets at least one slot in a full week', t => {
	const slots = buildSlots(PRODUCTS, 30);
	t.is(slots.length, 30);
	for (const p of PRODUCTS) {
		t.true(
			slots.some(s => s.source === p.slug),
			`${p.slug} has a slot`,
		);
	}
	t.true(slots.some(s => s.sourceKind === 'collective'));
});

const SLOTS: Slot[] = buildSlots(PRODUCTS, 3);

function validPlanJson(): string {
	return JSON.stringify([
		{file: 'nanocoder-1.md', angle: 'mcp support', focus: 'Explain MCP.'},
		{file: 'get-md-1.md', angle: 'url to markdown', focus: 'One-shot fetch.'},
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
			['nanocoder-1.md', 'get-md-1.md', 'collective-1.md'],
		);
	}
});

test('parseXDailyPlan: keeps a valid archetype from the plan', t => {
	const plan = JSON.parse(validPlanJson());
	plan[0].archetype = 'sharp-take';
	const result = parseXDailyPlan(JSON.stringify(plan), SLOTS);
	t.true(result.ok);
	if (result.ok) {
		const entry = result.plan.find(p => p.file === 'nanocoder-1.md');
		t.is(entry?.archetype, 'sharp-take');
	}
});

test('parseXDailyPlan: coerces a missing/unknown archetype to a known id', t => {
	const plan = JSON.parse(validPlanJson());
	plan[1].archetype = 'not-a-real-archetype';
	// plan[0] and plan[2] have no archetype field at all.
	const result = parseXDailyPlan(JSON.stringify(plan), SLOTS);
	t.true(result.ok);
	if (result.ok) {
		for (const entry of result.plan) {
			t.true(
				ARCHETYPES.some(a => a.id === entry.archetype),
				`${entry.file} got a known archetype (${entry.archetype})`,
			);
		}
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
		{file: 'nanocoder-1.md', angle: 'a', focus: 'f'},
		{file: 'get-md-1.md', angle: 'a', focus: 'f'},
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
	plan.push({file: 'nanocoder-1.md', angle: 'dup', focus: 'f'});
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

test('summarizeRecentAngles: shows the archetype when present', t => {
	const summary = summarizeRecentAngles(
		[
			{
				date: '2026-06-08',
				source: 'nanocoder',
				angle: 'recent angle',
				archetype: 'sharp-take',
				preview: '',
			},
		],
		SLOTS,
	);
	t.true(summary.includes('(sharp-take) recent angle'));
});

test('archetypeById: resolves a known id and misses an unknown one', t => {
	t.is(archetypeById('sharp-take')?.id, 'sharp-take');
	t.is(archetypeById('nope'), undefined);
});

test('archetypesCatalogue: lists every archetype id', t => {
	const catalogue = archetypesCatalogue();
	for (const a of ARCHETYPES) t.true(catalogue.includes(a.id));
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
