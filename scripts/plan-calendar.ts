/**
 * The daily "planner": the scheduling half of the content calendar. It
 * GENERATES NOTHING — it reads already-committed content and places references
 * to it onto calendar days, writing one ledger per week to
 * content/_calendar/<monday>.json. The calendar page renders those ledgers.
 *
 * It runs daily (cron) and on any push to content/** (excluding _calendar/**),
 * and is safe to run repeatedly: buildWeek is deterministic and idempotent, so
 * re-running only reflows future, not-yet-actioned items (a new release lands,
 * something is marked distributed / won't-use). Past days and already-
 * distributed items are pinned. See agents/calendar-plan.md and lib/calendar.ts.
 *
 *   pnpm plan-calendar                       # today, writes to content/_local/
 *   pnpm plan-calendar --date 2026-07-08 --test
 *   pnpm plan-calendar --commit              # writes to content/ (the CI path)
 *   pnpm plan-calendar --dry-run             # print the ledgers, write nothing
 *
 * Always exits 0 on a clean plan (the calendar is derived; there is nothing to
 * "fail"), 1 only on an unexpected error.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {
	addWeeks,
	buildWeek,
	CALENDAR_DIR,
	gatherPools,
	mondayOf,
	readSchedule,
	scheduledSetIds,
	type WeekSchedule,
	weekDates,
	X_PER_DAY,
	xCount,
} from '../lib/calendar.js';

const ROOT = process.cwd();

export type RunMode = 'commit' | 'local' | 'test';

type Args = {
	date: string;
	mode: RunMode;
	weeks: number;
	xPerDay: number;
	dryRun: boolean;
};

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			date: {type: 'string'},
			commit: {type: 'boolean', default: false},
			test: {type: 'boolean', default: false},
			weeks: {type: 'string', default: '6'},
			'x-per-day': {type: 'string', default: String(X_PER_DAY)},
			'dry-run': {type: 'boolean', default: false},
		},
	});
	const mode: RunMode = values.commit
		? 'commit'
		: values.test
			? 'test'
			: 'local';
	return {
		date: (values.date as string | undefined) ?? todayIso(),
		mode,
		weeks: Number.parseInt(values.weeks as string, 10),
		xPerDay: Number.parseInt(values['x-per-day'] as string, 10),
		dryRun: values['dry-run'] as boolean,
	};
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function contentRootFor(mode: RunMode): string {
	switch (mode) {
		case 'commit':
			return 'content';
		case 'test':
			return 'content/_test';
		case 'local':
			return 'content/_local';
	}
}

/** One-line summary of a week for the run log. */
function summarize(week: WeekSchedule, today: string): string {
	const dates = weekDates(week.week_of);
	const parts: string[] = [];
	const releaseSets = new Set<string>();
	let backlog = 0;
	for (const date of dates) {
		const items = week.days[date] ?? [];
		if (date >= today) {
			const x = xCount(items);
			if (items.length > 0) parts.push(`${date.slice(5)}:${x}x`);
		}
		for (const it of items) {
			if (it.release_set) releaseSets.add(it.release_set);
			if (it.type === 'backlog-article' && it.channel === 'github-discussion') {
				backlog++;
			}
		}
	}
	const extras: string[] = [];
	if (releaseSets.size > 0)
		extras.push(`releases: ${[...releaseSets].join(', ')}`);
	if (backlog > 0) extras.push(`${backlog} backlog article(s)`);
	return `${week.week_of}  ${parts.join(' ') || '(empty)'}${
		extras.length ? `  [${extras.join('; ')}]` : ''
	}`;
}

async function main() {
	const args = parse();
	const canonical = join(ROOT, 'content');
	const outRoot = join(ROOT, contentRootFor(args.mode));
	const generatedAt = new Date().toISOString();
	const today = args.date;

	const alreadyScheduled = scheduledSetIds(canonical, today);
	const pools = gatherPools(canonical, alreadyScheduled);
	console.log(
		`plan-calendar: ${today} (mode=${args.mode}) — pools: ${pools.releaseSets.length} pending release set(s), ${pools.backlogArticles.length} backlog article(s), ${pools.evergreenX.length} evergreen X post(s)`,
	);

	const consumedRefs = new Set<string>();
	const consumedSetIds = new Set<string>();
	const startMonday = mondayOf(today);
	const written: WeekSchedule[] = [];

	for (let i = 0; i < args.weeks; i++) {
		const weekOf = addWeeks(startMonday, i);
		const existing = readSchedule(weekOf, canonical);
		const week = buildWeek({
			weekOf,
			today,
			existing,
			pools,
			consumedRefs,
			consumedSetIds,
			xPerDay: args.xPerDay,
			generatedAt,
		});
		const totalItems = Object.values(week.days).reduce(
			(n, items) => n + items.length,
			0,
		);
		// The current week is always written; later weeks only if they have
		// content to show or an existing ledger to refresh.
		if (i > 0 && totalItems === 0 && !existing) break;
		written.push(week);
	}

	for (const week of written) console.log(`  ${summarize(week, today)}`);

	if (args.dryRun) {
		console.log('\n--- DRY RUN: ledgers below, nothing written ---\n');
		for (const week of written) {
			console.log(`# ${week.week_of}.json`);
			console.log(JSON.stringify(week, null, 2));
		}
		process.exit(0);
	}

	const calendarDir = join(outRoot, CALENDAR_DIR);
	mkdirSync(calendarDir, {recursive: true});
	for (const week of written) {
		writeFileSync(
			join(calendarDir, `${week.week_of}.json`),
			`${JSON.stringify(week, null, 2)}\n`,
		);
	}
	console.log(
		`\nplan-calendar: ✓ wrote ${written.length} week ledger(s) → ${calendarDir}`,
	);
	process.exit(0);
}
/* c8 ignore stop */

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
