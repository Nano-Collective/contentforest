import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	addWeeks,
	buildWeek,
	type EvergreenItem,
	gatherPools,
	interleaveBySource,
	mondayOf,
	type Pools,
	type RefStatus,
	type ReleaseSet,
	type WeekSchedule,
	weekDates,
	xCount,
} from './calendar.js';

// ── date helpers ─────────────────────────────────────────────────────────────

test('mondayOf: returns the Monday of the week', t => {
	// 2026-07-06 is a Monday; 07-08 (Wed) and 07-12 (Sun) map back to it.
	t.is(mondayOf('2026-07-06'), '2026-07-06');
	t.is(mondayOf('2026-07-08'), '2026-07-06');
	t.is(mondayOf('2026-07-12'), '2026-07-06');
	t.is(mondayOf('2026-07-13'), '2026-07-13');
});

test('weekDates: seven consecutive dates Mon..Sun', t => {
	t.deepEqual(weekDates('2026-07-06'), [
		'2026-07-06',
		'2026-07-07',
		'2026-07-08',
		'2026-07-09',
		'2026-07-10',
		'2026-07-11',
		'2026-07-12',
	]);
});

test('addWeeks: shifts by whole weeks', t => {
	t.is(addWeeks('2026-07-06', 1), '2026-07-13');
	t.is(addWeeks('2026-07-06', -1), '2026-06-29');
});

test('interleaveBySource: round-robins across sources', t => {
	const items: EvergreenItem[] = [
		{ref: 'a1', source: 'a', generatedAt: ''},
		{ref: 'a2', source: 'a', generatedAt: ''},
		{ref: 'b1', source: 'b', generatedAt: ''},
	];
	t.deepEqual(
		interleaveBySource(items).map(i => i.ref),
		['a1', 'b1', 'a2'],
	);
});

// ── buildWeek: pool construction helper ──────────────────────────────────────

const WEEK = '2026-07-06';

function poolsFrom(parts: {
	releaseSets?: ReleaseSet[];
	backlogArticles?: Pools['backlogArticles'];
	evergreenX?: EvergreenItem[];
	statusOverrides?: Record<string, RefStatus>;
}): Pools {
	const refStatus = new Map<string, RefStatus>();
	const reg = (ref: string) =>
		refStatus.set(ref, parts.statusOverrides?.[ref] ?? 'unused');
	for (const set of parts.releaseSets ?? [])
		for (const it of set.items) reg(it.ref);
	for (const a of parts.backlogArticles ?? []) {
		reg(a.anchorRef);
		for (const s of a.siblings) reg(s.ref);
	}
	for (const e of parts.evergreenX ?? []) reg(e.ref);
	// Any override for a ref we didn't otherwise register.
	for (const [ref, st] of Object.entries(parts.statusOverrides ?? {}))
		if (!refStatus.has(ref)) refStatus.set(ref, st);
	return {
		releaseSets: parts.releaseSets ?? [],
		backlogArticles: parts.backlogArticles ?? [],
		evergreenX: parts.evergreenX ?? [],
		refStatus,
	};
}

function run(input: {
	pools: Pools;
	today?: string;
	existing?: WeekSchedule | null;
	xPerDay?: number;
}): WeekSchedule {
	return buildWeek({
		weekOf: WEEK,
		today: input.today ?? WEEK,
		existing: input.existing ?? null,
		pools: input.pools,
		consumedRefs: new Set(),
		consumedSetIds: new Set(),
		xPerDay: input.xPerDay,
		generatedAt: '2026-07-06T00:00:00Z',
	});
}

function evergreen(n: number): EvergreenItem[] {
	return Array.from({length: n}, (_, i) => ({
		ref: `content/_x-daily/${WEEK}/posts/p${i}.md`,
		source: `s${i % 3}`,
		generatedAt: `2026-07-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
	}));
}

// ── R1: six X posts per day ──────────────────────────────────────────────────

test('R1: fills every future weekday to xPerDay X posts, skips weekends', t => {
	const week = run({pools: poolsFrom({evergreenX: evergreen(42)})});
	const dates = weekDates(WEEK); // Mon..Sun
	for (const d of dates.slice(0, 5)) {
		t.is(xCount(week.days[d]), 6, `${d} (weekday) should have 6 X posts`);
	}
	t.is(xCount(week.days[dates[5]]), 0, 'Saturday is empty');
	t.is(xCount(week.days[dates[6]]), 0, 'Sunday is empty');
});

test('R1: leaves gaps when the evergreen pool is short', t => {
	const week = run({pools: poolsFrom({evergreenX: evergreen(10)})});
	const total = weekDates(WEEK).reduce((n, d) => n + xCount(week.days[d]), 0);
	t.is(total, 10);
});

test('R1: does not repeat a source on the same day while alternatives exist', t => {
	// 3 sources, 6 slots/day — first 3 picks distinct, then it may repeat.
	const week = run({pools: poolsFrom({evergreenX: evergreen(42)})});
	const first = week.days[WEEK]
		.filter(i => i.channel === 'x')
		.slice(0, 3)
		.map(i => i.source);
	t.is(new Set(first).size, 3);
});

// ── R3 + R4: releases, one set per day ───────────────────────────────────────

function releaseSet(id: string, product: string): ReleaseSet {
	return {
		id,
		product,
		version: id.split('@')[1],
		newestAt: '2026-07-05T00:00:00Z',
		items: [
			{
				ref: `content/${product}/x/channels/github-discussion.md`,
				channel: 'github-discussion',
				isArticle: false,
			},
			{
				ref: `content/${product}/x/channels/x.md`,
				channel: 'x',
				isArticle: false,
			},
		],
	};
}

test('R4: two release sets land on different days, earliest first', t => {
	const week = run({
		pools: poolsFrom({
			releaseSets: [
				releaseSet('aaa@2.0.0', 'aaa'),
				releaseSet('bbb@1.0.0', 'bbb'),
			],
		}),
	});
	const setsOn = (d: string) => [
		...new Set(week.days[d].filter(i => i.release_set).map(i => i.release_set)),
	];
	// Freshly-generated releases start the next working day, not today (Monday).
	t.deepEqual(setsOn('2026-07-06'), []);
	t.deepEqual(setsOn('2026-07-07'), ['aaa@2.0.0']);
	t.deepEqual(setsOn('2026-07-08'), ['bbb@1.0.0']);
});

test('weekdays only: releases never land on a weekend', t => {
	const sets = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'].map(p =>
		releaseSet(`${p}@1.0.0`, p),
	);
	const week = run({pools: poolsFrom({releaseSets: sets})});
	const dates = weekDates(WEEK); // Mon..Sun
	t.is(week.days[dates[5]].length, 0, 'Saturday is empty');
	t.is(week.days[dates[6]].length, 0, 'Sunday is empty');
	// Releases start the next working day, so Monday (today) is skipped: Tue–Fri
	// each take one set; the remaining two wait for a later week.
	t.false(
		week.days[dates[0]].some(i => i.release_set),
		'Monday (today) takes no fresh release',
	);
	const weekdaysWithRelease = dates
		.slice(0, 5)
		.filter(d => week.days[d].some(i => i.release_set)).length;
	t.is(weekdaysWithRelease, 4);
});

test('R3: a release X post counts toward the day’s six', t => {
	const week = run({
		pools: poolsFrom({
			releaseSets: [releaseSet('aaa@2.0.0', 'aaa')],
			evergreenX: evergreen(42),
		}),
	});
	// The release lands Tuesday (next working day) and still has exactly 6 X
	// posts, one of them the release X.
	t.is(xCount(week.days['2026-07-07']), 6);
	t.true(
		week.days['2026-07-07'].some(
			i => i.channel === 'x' && i.type === 'release',
		),
	);
});

// ── R2: one backlog article per week ─────────────────────────────────────────

const backlog = {
	anchorRef: 'content/get-md/1.0.0/articles/foo/channels/github-discussion.md',
	generatedAt: '2026-06-01T00:00:00Z',
	siblings: [
		{
			ref: 'content/get-md/1.0.0/articles/foo/channels/reddit.md',
			channel: 'reddit',
		},
		{ref: 'content/get-md/1.0.0/articles/foo/channels/x.md', channel: 'x'},
	],
};

test('R2: places one backlog article + siblings when none scheduled', t => {
	const week = run({pools: poolsFrom({backlogArticles: [backlog]})});
	const all = Object.values(week.days).flat();
	const article = all.filter(i => i.type === 'backlog-article');
	t.is(article.length, 3);
	t.true(article.some(i => i.channel === 'github-discussion'));
	// A freshly-placed backlog article starts the next working day, not today.
	t.false(
		week.days['2026-07-06'].some(i => i.type === 'backlog-article'),
		'Monday (today) takes no fresh backlog article',
	);
});

test('R2: prefers a day with no release set', t => {
	const week = run({
		pools: poolsFrom({
			releaseSets: [releaseSet('aaa@2.0.0', 'aaa')],
			backlogArticles: [backlog],
		}),
	});
	// Both land on fresh weekdays (after today = Monday): the release takes
	// Tuesday, so the backlog article avoids it and takes a later day with no
	// release set. Neither is placed on today.
	t.false(
		week.days['2026-07-06'].some(i => i.type === 'backlog-article'),
		'Monday (today) takes no fresh backlog article',
	);
	t.false(
		week.days['2026-07-07'].some(i => i.type === 'backlog-article'),
		'the release day gets no backlog article',
	);
	const backlogDays = weekDates(WEEK).filter(d =>
		week.days[d].some(i => i.type === 'backlog-article'),
	);
	t.true(backlogDays.length > 0);
	t.false(backlogDays.some(d => week.days[d].some(i => i.release_set)));
});

// ── pinning + reflow ─────────────────────────────────────────────────────────

test('pinning: actioned past items stay; future won’t-use is dropped', t => {
	const wed = '2026-07-08';
	const existing: WeekSchedule = {
		week_of: WEEK,
		generated_at: 'x',
		days: {
			'2026-07-06': [
				{
					slot: 'x-1',
					channel: 'x',
					type: 'evergreen-x',
					ref: 'donePast.md',
					source: 's0',
				},
			],
			'2026-07-09': [
				{
					slot: 'x-1',
					channel: 'x',
					type: 'evergreen-x',
					ref: 'keep.md',
					source: 's0',
				},
				{
					slot: 'x-2',
					channel: 'x',
					type: 'evergreen-x',
					ref: 'drop.md',
					source: 's1',
				},
			],
		},
	};
	const week = run({
		today: wed,
		existing,
		pools: poolsFrom({
			statusOverrides: {
				'donePast.md': 'distributed',
				'keep.md': 'distributed',
				'drop.md': 'wont_use',
			},
		}),
	});
	// A distributed past item is preserved as the historical record.
	t.deepEqual(
		week.days['2026-07-06'].map(i => i.ref),
		['donePast.md'],
	);
	// Future Thursday keeps the distributed one, drops the won't-use one.
	const thu = week.days['2026-07-09'].map(i => i.ref);
	t.true(thu.includes('keep.md'));
	t.false(thu.includes('drop.md'));
});

test('reflow: an unposted (unused) past item moves forward, not stranded', t => {
	const wed = '2026-07-08';
	const existing: WeekSchedule = {
		week_of: WEEK,
		generated_at: 'x',
		days: {
			'2026-07-06': [
				{
					slot: 'x-1',
					channel: 'x',
					type: 'evergreen-x',
					ref: 'posted.md',
					source: 's0',
				},
				{
					slot: 'x-2',
					channel: 'x',
					type: 'evergreen-x',
					ref: 'missed.md',
					source: 's0',
				},
			],
		},
	};
	const week = run({
		today: wed,
		existing,
		pools: poolsFrom({
			evergreenX: [
				{ref: 'missed.md', source: 's0', generatedAt: '2026-07-01T00:00:00Z'},
			],
			statusOverrides: {'posted.md': 'distributed', 'missed.md': 'unused'},
		}),
	});
	// Monday keeps only the posted item — the missed one is gone from the past.
	t.deepEqual(
		week.days['2026-07-06'].map(i => i.ref),
		['posted.md'],
	);
	// The missed item reflowed onto a future weekday.
	const future = Object.entries(week.days)
		.filter(([d]) => d >= wed)
		.flatMap(([, items]) => items)
		.map(i => i.ref);
	t.true(future.includes('missed.md'));
});

test('idempotency: rebuilding from its own output is a no-op', t => {
	const pools = poolsFrom({
		releaseSets: [releaseSet('aaa@2.0.0', 'aaa')],
		backlogArticles: [backlog],
		evergreenX: evergreen(42),
	});
	const first = run({pools});
	const second = buildWeek({
		weekOf: WEEK,
		today: WEEK,
		existing: first,
		pools,
		consumedRefs: new Set(),
		consumedSetIds: new Set(),
		generatedAt: 'later',
	});
	t.deepEqual(second.days, first.days);
});

// ── gatherPools (filesystem) ─────────────────────────────────────────────────

function writeMd(
	path: string,
	fm: Record<string, string>,
	body = 'A body that links to https://github.com/Nano-Collective/x for the pack.',
) {
	mkdirSync(join(path, '..'), {recursive: true});
	const lines = ['---'];
	for (const [k, v] of Object.entries(fm)) lines.push(`${k}: "${v}"`);
	lines.push('---', '', body, '');
	writeFileSync(path, lines.join('\n'), 'utf8');
}

test('gatherPools: latest version → release set, older → backlog', t => {
	const cwd = process.cwd();
	const tmp = mkdtempSync(join(tmpdir(), 'cf-cal-'));
	const content = join(tmp, 'content');
	process.chdir(tmp);
	try {
		writeMd(join(content, 'alpha/2.0.0/channels/github-discussion.md'), {
			channel: 'github-discussion',
			generated_at: '2026-07-05T00:00:00Z',
		});
		writeMd(join(content, 'alpha/2.0.0/channels/x.md'), {
			channel: 'x',
			generated_at: '2026-07-05T00:00:00Z',
		});
		writeMd(join(content, 'alpha/1.0.0/channels/github-discussion.md'), {
			channel: 'github-discussion',
			generated_at: '2026-01-01T00:00:00Z',
		});
		writeMd(join(content, '_collective/launch/channels/github-discussion.md'), {
			channel: 'github-discussion',
			generated_at: '2026-02-01T00:00:00Z',
		});
		// An article on the LATEST version: it must NOT join the release set —
		// articles are evergreen backlog, only the announcement is a release.
		writeMd(
			join(content, 'alpha/2.0.0/articles/foo/channels/github-discussion.md'),
			{channel: 'github-discussion', generated_at: '2026-07-05T00:00:00Z'},
		);
		writeMd(join(content, `_x-daily/${WEEK}/posts/alpha.md`), {
			channel: 'x',
			source: 'alpha',
			generated_at: '2026-07-06T00:00:00Z',
		});

		const pools = gatherPools(content);
		t.is(pools.releaseSets.length, 1);
		t.is(pools.releaseSets[0].id, 'alpha@2.0.0');
		// Only the two top-level announcement channels — NOT the article.
		t.is(pools.releaseSets[0].items.length, 2);
		t.false(pools.releaseSets[0].items.some(i => i.ref.includes('/articles/')));
		// Backlog anchors: older alpha 1.0.0, collective, AND the 2.0.0 article.
		t.is(pools.backlogArticles.length, 3);
		t.true(
			pools.backlogArticles.some(a =>
				a.anchorRef.includes('2.0.0/articles/foo'),
			),
		);
		t.is(pools.evergreenX.length, 1);
	} finally {
		process.chdir(cwd);
		rmSync(tmp, {recursive: true});
	}
});

test('gatherPools: distributed content is excluded from pools', t => {
	const cwd = process.cwd();
	const tmp = mkdtempSync(join(tmpdir(), 'cf-cal-'));
	const content = join(tmp, 'content');
	process.chdir(tmp);
	try {
		writeMd(join(content, `_x-daily/${WEEK}/posts/a.md`), {
			channel: 'x',
			source: 'alpha',
			generated_at: '2026-07-06T00:00:00Z',
		});
		writeMd(join(content, `_x-daily/${WEEK}/posts/b.md`), {
			channel: 'x',
			source: 'beta',
			generated_at: '2026-07-06T00:00:00Z',
			distributed_at: '2026-07-06T10:00:00Z',
		});
		const pools = gatherPools(content);
		t.is(pools.evergreenX.length, 1);
		t.is(pools.evergreenX[0].source, 'alpha');
	} finally {
		process.chdir(cwd);
		rmSync(tmp, {recursive: true});
	}
});

test('gatherPools: an already-scheduled latest version falls back to backlog', t => {
	const cwd = process.cwd();
	const tmp = mkdtempSync(join(tmpdir(), 'cf-cal-'));
	const content = join(tmp, 'content');
	process.chdir(tmp);
	try {
		writeMd(join(content, 'alpha/2.0.0/channels/github-discussion.md'), {
			channel: 'github-discussion',
			generated_at: '2026-07-05T00:00:00Z',
		});
		const pools = gatherPools(content, new Set(['alpha@2.0.0']));
		t.is(pools.releaseSets.length, 0);
		t.is(pools.backlogArticles.length, 1);
	} finally {
		process.chdir(cwd);
		rmSync(tmp, {recursive: true});
	}
});
