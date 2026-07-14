/**
 * The scheduling layer that sits between content GENERATION (release packs,
 * the weekly X batch, the backlog of unused content) and the calendar UI.
 *
 * Nothing here generates content. The functions gather already-committed
 * content into pools, then place references to it onto calendar days under a
 * per-week ledger at `content/_calendar/<monday>.json`. The calendar page reads
 * those ledgers and resolves each `ref` back to its live content file — so a
 * post's distribution status (`distributed_at` / `wont_use_at`) always lives in
 * the file's own frontmatter, never duplicated into the ledger.
 *
 * Placement rules (see agents/calendar-plan.md §2):
 *   R1  6 X posts per day.
 *   R2  ≥1 GitHub-discussion article (+ its sibling reddit/x/linkedin) per week,
 *       drawn from the unused backlog. Independent of releases.
 *   R3  A new product version's release posts are slotted promptly.
 *   R4  ≤1 release *set* per day — two products releasing spread over ≥2 days.
 *
 * buildWeek is deterministic and idempotent: given the same content, the same
 * prior ledger and the same `today`, it returns the same schedule. It "reflows"
 * — future, not-yet-actioned items may move when a release arrives or an item
 * is marked distributed/won't-use, and a still-unused release set drifts
 * BACKWARD onto today / an earlier free weekday when one opens up — but it never
 * touches past days or any item already distributed (those are pinned). A release
 * that was never posted before its scheduled day passed is not stranded either:
 * it drops out of scheduledSetIds and re-enters the release pool, so it reflows
 * FORWARD onto the next free weekday as a release (never demoted to backlog).
 * That combination is what keeps repeated planner runs stable rather than
 * oscillating.
 */
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import matter from 'gray-matter';
import {
	addWeeks,
	isWeekday,
	mondayOf,
	monthLabel,
	weekDates,
} from './calendar-dates';
import {compareVersionsDesc, listProducts} from './content';

const DEFAULT_CONTENT_DIR = join(process.cwd(), 'content');

export const CALENDAR_DIR = '_calendar';
const X_DAILY_DIR = '_x-daily';
const COLLECTIVE_DIR = '_collective';

export const X_PER_DAY = 6;

export type SlotType = 'release' | 'backlog-article' | 'evergreen-x';

export type RefStatus = 'unused' | 'distributed' | 'wont_use';

/** One placed piece of content on a calendar day. Status is NOT stored here. */
export type ScheduledItem = {
	slot: string;
	channel: string;
	type: SlotType;
	ref: string;
	/** "<product>@<version>" for release items; groups a set for R4 + the UI. */
	release_set?: string;
	/** The evergreen X source (product slug or "collective"), for rotation. */
	source?: string;
};

export type WeekSchedule = {
	week_of: string;
	generated_at: string;
	days: Record<string, ScheduledItem[]>;
};

/** A product-version's unused release posts, scheduled together on one day. */
export type ReleaseSet = {
	id: string;
	product: string;
	version: string;
	newestAt: string;
	items: {ref: string; channel: string; isArticle: boolean}[];
};

/** An unused github-discussion + its sibling channel posts, for R2. */
export type BacklogArticle = {
	anchorRef: string;
	generatedAt: string;
	siblings: {ref: string; channel: string}[];
};

export type EvergreenItem = {ref: string; source: string; generatedAt: string};

export type Pools = {
	releaseSets: ReleaseSet[];
	backlogArticles: BacklogArticle[];
	evergreenX: EvergreenItem[];
	/** Per-ref status, so buildWeek can prune/pin without touching the fs. */
	refStatus: Map<string, RefStatus>;
};

// Pure date helpers live in ./calendar-dates (no fs) so pages/components can
// import them without dragging this server-only module into a client bundle.
export {
	addMonths,
	addWeeks,
	mondayOf,
	monthKeyOf,
	weekDates,
} from './calendar-dates';

// ── Frontmatter / channel helpers (mirrors weekly-pack + validator) ──────────

/** distribution status of a frontmatter blob. */
function statusOf(fm: Record<string, unknown>): RefStatus {
	const has = (v: unknown) => typeof v === 'string' && v.length > 0;
	if (has(fm.distributed_at)) return 'distributed';
	if (has(fm.wont_use_at)) return 'wont_use';
	return 'unused';
}

/**
 * The base channel slug for a content-reader channel key, or null to exclude.
 * Article files come through as `article:<slug>:<channel>`; personal variants
 * (`personal:...`) are never scheduled.
 */
function baseChannelOf(channel: string): string | null {
	let c = channel;
	if (c.startsWith('article:')) {
		const afterArticle = c.slice('article:'.length);
		const colon = afterArticle.indexOf(':');
		c = colon >= 0 ? afterArticle.slice(colon + 1) : '';
	}
	if (c === '' || c === 'personal' || c.startsWith('personal:')) return null;
	return c;
}

function generatedAtOf(fm: Record<string, unknown>): string {
	return typeof fm.generated_at === 'string' ? fm.generated_at : '';
}

// ── Ledger IO ────────────────────────────────────────────────────────────────

function ledgerPathFor(contentDir: string, weekOf: string): string {
	return join(contentDir, CALENDAR_DIR, `${weekOf}.json`);
}

/** Read one week's ledger, or null if absent/unparseable. */
export function readSchedule(
	weekOf: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): WeekSchedule | null {
	const path = ledgerPathFor(contentDir, weekOf);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as WeekSchedule;
	} catch {
		return null;
	}
}

/** Every week ledger present, newest first. */
function listSchedules(
	contentDir: string = DEFAULT_CONTENT_DIR,
): WeekSchedule[] {
	const dir = join(contentDir, CALENDAR_DIR);
	let entries: string[];
	try {
		entries = readdirSync(dir).filter(e => e.endsWith('.json'));
	} catch {
		return [];
	}
	const weeks: WeekSchedule[] = [];
	for (const entry of entries) {
		const week = readSchedule(entry.replace(/\.json$/, ''), contentDir);
		if (week) weeks.push(week);
	}
	weeks.sort((a, b) => b.week_of.localeCompare(a.week_of));
	return weeks;
}

/**
 * Every "<product>@<version>" release set already scheduled on a LIVE day.
 *
 * gatherPools uses this to keep a release that's already on the calendar out of
 * the "pending release" pool (the on-calendar copy is owned by ledger seeding +
 * the backward-reflow in buildWeek). But a release parked ONLY on past days that
 * was never posted is a missed release — it must NOT count as scheduled, so it
 * falls back into the pool and reflows onto the next free weekday rather than
 * being stranded. Passing `today` restricts the scan to today-or-later
 * placements; omitting it counts every placement (the historical behaviour).
 * A release distributed in the past is excluded from the pool separately, by its
 * file status, so it does not reappear regardless.
 */
export function scheduledSetIds(
	contentDir: string = DEFAULT_CONTENT_DIR,
	today?: string,
): Set<string> {
	const ids = new Set<string>();
	for (const week of listSchedules(contentDir)) {
		for (const [date, items] of Object.entries(week.days)) {
			if (today && date < today) continue;
			for (const item of items) {
				if (item.release_set) ids.add(item.release_set);
			}
		}
	}
	return ids;
}

// ── Pool gathering ───────────────────────────────────────────────────────────

type RawFile = {
	ref: string;
	channel: string; // base channel
	isArticle: boolean;
	dir: string; // directory of the file, for sibling grouping
	status: RefStatus;
	generatedAt: string;
};

/** Read one product-version pack's channel + article files (skips personal). */
function readPackFiles(contentDir: string, product: string, version: string) {
	const out: RawFile[] = [];
	const packRoot = join(contentDir, product, version);
	// channels/ (announcement) at prefix '', articles/<slug>/channels at
	// prefix 'article:<slug>:'. Read both by walking channels dirs directly so
	// we keep the on-disk directory for sibling grouping.
	collectChannelDir(join(packRoot, 'channels'), false, out);
	const articlesDir = join(packRoot, 'articles');
	if (existsSync(articlesDir)) {
		for (const slug of safeReaddir(articlesDir)) {
			collectChannelDir(join(articlesDir, slug, 'channels'), true, out);
		}
	}
	return out;
}

function collectChannelDir(
	channelsDir: string,
	isArticle: boolean,
	out: RawFile[],
): void {
	if (!existsSync(channelsDir)) return;
	for (const entry of safeReaddir(channelsDir)) {
		if (!entry.endsWith('.md')) continue;
		const channel = baseChannelOf(entry.replace(/\.md$/, ''));
		if (!channel) continue;
		const full = join(channelsDir, entry);
		const parsed = matter(readFileSync(full, 'utf8'));
		const fm = parsed.data as Record<string, unknown>;
		if (parsed.content.trim().length === 0) continue; // empty scaffold
		out.push({
			ref: relative(process.cwd(), full),
			channel,
			isArticle,
			dir: channelsDir,
			status: statusOf(fm),
			generatedAt: generatedAtOf(fm),
		});
	}
}

function safeReaddir(path: string): string[] {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
}

/**
 * Gather every schedulable pool from committed content:
 *   - releaseSets: the LATEST version of each product, if it hasn't already
 *     been scheduled in a prior ledger. Older versions become backlog.
 *   - backlogArticles: unused github-discussion files not part of a pending
 *     release set (older product versions + collective packs), each with its
 *     unused sibling channels.
 *   - evergreenX: unused X posts from the _x-daily batch buckets.
 * refStatus indexes every ref seen so buildWeek can prune/pin.
 */
export function gatherPools(
	contentDir: string = DEFAULT_CONTENT_DIR,
	alreadyScheduledSets: Set<string> = new Set(),
): Pools {
	const refStatus = new Map<string, RefStatus>();
	const releaseSets: ReleaseSet[] = [];
	const backlogByDir = new Map<string, RawFile[]>();

	const noteBacklog = (f: RawFile) => {
		const list = backlogByDir.get(f.dir) ?? [];
		list.push(f);
		backlogByDir.set(f.dir, list);
	};

	for (const product of listProducts(contentDir)) {
		const versions = [...product.versions].sort(compareVersionsDesc);
		const latest = versions[0] ?? null;
		for (const version of versions) {
			const setId = `${product.slug}@${version}`;
			const files = readPackFiles(contentDir, product.slug, version);
			const isPendingRelease =
				version === latest && !alreadyScheduledSets.has(setId);
			const releaseItems: ReleaseSet['items'] = [];
			let newestAt = '';
			for (const f of files) {
				refStatus.set(f.ref, f.status);
				if (f.status !== 'unused') continue;
				// A release set is ONLY the version's top-level announcement (the
				// timely "new version" posts, R3). Deep-dive articles are evergreen
				// support: they always go to the backlog pool and get dripped one a
				// week (R2), never bundled onto the release day. So once the
				// announcement is distributed, the release is "done" and its
				// articles just flow into the normal backlog rotation.
				if (isPendingRelease && !f.isArticle) {
					releaseItems.push({
						ref: f.ref,
						channel: f.channel,
						isArticle: false,
					});
					if (f.generatedAt > newestAt) newestAt = f.generatedAt;
				} else {
					noteBacklog(f);
				}
			}
			if (isPendingRelease && releaseItems.length > 0) {
				releaseSets.push({
					id: setId,
					product: product.slug,
					version,
					newestAt,
					items: releaseItems,
				});
			}
		}
	}

	// Collective packs are product-independent — pure backlog, no releases.
	const collectiveDir = join(contentDir, COLLECTIVE_DIR);
	for (const slug of safeReaddir(collectiveDir)) {
		const channelsDir = join(collectiveDir, slug, 'channels');
		const files: RawFile[] = [];
		collectChannelDir(channelsDir, false, files);
		for (const f of files) {
			refStatus.set(f.ref, f.status);
			if (f.status === 'unused') noteBacklog(f);
		}
	}

	// Turn each backlog directory that has an unused github-discussion into a
	// BacklogArticle anchored on it, with its unused siblings as support.
	const backlogArticles: BacklogArticle[] = [];
	for (const files of backlogByDir.values()) {
		const anchor = files.find(f => f.channel === 'github-discussion');
		if (!anchor) continue;
		backlogArticles.push({
			anchorRef: anchor.ref,
			generatedAt: anchor.generatedAt,
			siblings: files
				.filter(f => f.ref !== anchor.ref)
				.map(f => ({ref: f.ref, channel: f.channel})),
		});
	}
	backlogArticles.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

	// Evergreen X: every unused post under _x-daily/*/posts/*.md.
	const evergreenX: EvergreenItem[] = [];
	const xDailyDir = join(contentDir, X_DAILY_DIR);
	for (const bucket of safeReaddir(xDailyDir)) {
		const postsDir = join(xDailyDir, bucket, 'posts');
		for (const entry of safeReaddir(postsDir)) {
			if (!entry.endsWith('.md')) continue;
			const full = join(postsDir, entry);
			const parsed = matter(readFileSync(full, 'utf8'));
			const fm = parsed.data as Record<string, unknown>;
			const ref = relative(process.cwd(), full);
			const status = statusOf(fm);
			refStatus.set(ref, status);
			if (status !== 'unused') continue;
			evergreenX.push({
				ref,
				source: typeof fm.source === 'string' ? fm.source : 'collective',
				generatedAt: generatedAtOf(fm),
			});
		}
	}
	evergreenX.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

	// Release sets: oldest-newest by product then newest version first, so the
	// ordering placement walks is stable and product-fair.
	releaseSets.sort(
		(a, b) =>
			a.product.localeCompare(b.product) ||
			compareVersionsDesc(a.version, b.version),
	);

	return {releaseSets, backlogArticles, evergreenX, refStatus};
}

// ── Week building ────────────────────────────────────────────────────────────

/** Interleave evergreen items round-robin across sources for fair spread. */
export function interleaveBySource(items: EvergreenItem[]): EvergreenItem[] {
	const bySource = new Map<string, EvergreenItem[]>();
	for (const it of items) {
		const list = bySource.get(it.source) ?? [];
		list.push(it);
		bySource.set(it.source, list);
	}
	// Deterministic source order.
	const sources = [...bySource.keys()].sort();
	const queues = sources.map(s => bySource.get(s) ?? []);
	const out: EvergreenItem[] = [];
	let added = true;
	while (added) {
		added = false;
		for (const q of queues) {
			const next = q.shift();
			if (next) {
				out.push(next);
				added = true;
			}
		}
	}
	return out;
}

type BuildInput = {
	weekOf: string;
	today: string;
	existing: WeekSchedule | null;
	pools: Pools;
	/** Mutated across a multi-week run so content isn't scheduled twice. */
	consumedRefs: Set<string>;
	consumedSetIds: Set<string>;
	xPerDay?: number;
	generatedAt: string;
};

/**
 * Build (or refresh) one week's schedule. Mutates `consumedRefs` /
 * `consumedSetIds` so a caller looping over several weeks never double-books.
 */
export function buildWeek(input: BuildInput): WeekSchedule {
	const xPerDay = input.xPerDay ?? X_PER_DAY;
	const dates = weekDates(input.weekOf);
	// New content is only placed on future WEEKDAYS — the calendar skips
	// weekends. (Past/weekend days are still seeded verbatim below, so anything
	// already scheduled there is preserved.)
	const future = dates.filter(d => d >= input.today && isWeekday(d));
	const days: Record<string, ScheduledItem[]> = {};
	for (const d of dates) days[d] = [];

	const status = (ref: string): RefStatus | undefined =>
		input.pools.refStatus.get(ref);

	// 1. Seed from the existing ledger.
	//    Past days keep only ACTIONED items (distributed / won't-use) as the
	//    historical record; a still-unused past item was "missed", so we drop it
	//    here and DON'T consume it — that lets it reflow forward through the pools
	//    onto an upcoming weekday, so the queue slides rather than stranding it.
	//    Future days keep live items (unused or distributed); drop won't-use and
	//    vanished files. Everything kept is consumed so it isn't re-placed.
	let weekHasBacklog = false;
	// Release sets un-pinned from seeding so step 2 can reflow them (see below),
	// keyed by id with their placed posts in ledger order.
	const heldSets: {id: string; items: {ref: string; channel: string}[]}[] = [];
	const heldIds = new Set<string>();
	if (input.existing) {
		// Pre-pass for backward reflow: group this week's FUTURE release posts by
		// set and flag any set that already has a distributed post. A set that is
		// still *entirely* unused is "held" — not pinned to its current day — so
		// step 2 can pull it BACKWARD onto today or an earlier free weekday when
		// one opens up (e.g. a release parked on Friday slides to today once
		// today's slot is free). A set with any distributed post stays pinned
		// where it was posted — you can't un-post it.
		// (A release parked only on PAST days that was never posted is handled
		// upstream by scheduledSetIds: it drops out of "already scheduled" and
		// re-enters the release pool, so step 2 places it fresh on the next free
		// weekday rather than it being stranded / demoted to backlog.)
		const futureItems = new Map<
			string,
			{date: string; ref: string; channel: string}[]
		>();
		const setHasDistributed = new Set<string>();
		for (const date of dates) {
			if (date < input.today) continue;
			for (const item of input.existing.days[date] ?? []) {
				if (!item.release_set) continue;
				const st = status(item.ref);
				if (st === undefined || st === 'wont_use') continue;
				const entry = {date, ref: item.ref, channel: item.channel};
				const list = futureItems.get(item.release_set);
				if (list) list.push(entry);
				else futureItems.set(item.release_set, [entry]);
				if (st === 'distributed') setHasDistributed.add(item.release_set);
			}
		}
		// Held sets, earliest-original-day first, so re-placement stays
		// earliest-first and deterministic.
		for (const [id, its] of [...futureItems.entries()]
			.filter(([setId]) => !setHasDistributed.has(setId))
			.sort(
				(a, b) =>
					a[1][0].date.localeCompare(b[1][0].date) || a[0].localeCompare(b[0]),
			)) {
			heldIds.add(id);
			heldSets.push({
				id,
				items: its.map(i => ({ref: i.ref, channel: i.channel})),
			});
		}

		for (const date of dates) {
			const items = input.existing.days[date] ?? [];
			const isPast = date < input.today;
			for (const item of items) {
				const st = status(item.ref);
				if (isPast) {
					if (st !== 'distributed' && st !== 'wont_use') continue;
				} else if (st === undefined || st === 'wont_use') {
					continue;
				}
				// A held (reflowable) set's posts are consumed so nothing else grabs
				// them, but left unplaced (and the id un-consumed) for step 2.
				if (!isPast && item.release_set && heldIds.has(item.release_set)) {
					input.consumedRefs.add(item.ref);
					continue;
				}
				days[date].push(item);
				input.consumedRefs.add(item.ref);
				if (item.release_set) input.consumedSetIds.add(item.release_set);
				if (item.type === 'backlog-article') weekHasBacklog = true;
			}
		}
	}

	const dayHasReleaseSet = (date: string): boolean =>
		days[date].some(i => i.release_set);

	// 2. R3 + R4: (re)place release sets on the earliest free future weekday.
	//    Held sets (fully-unused, un-pinned above) go first so a release reflows
	//    BACKWARD onto today / an earlier day when one frees up; then brand-new
	//    sets from the pool. Each set's posts are inserted at the FRONT of the day
	//    so a re-placed set keeps the same ordering as a fresh placement, which
	//    keeps repeated runs byte-stable. R4 keeps ≤1 set per day; a set with no
	//    free day this week is left for a later week (its id stays un-consumed).
	const pending = [
		...heldSets.map(h => ({...h, fromPool: false})),
		...input.pools.releaseSets
			.filter(s => !heldIds.has(s.id) && !input.consumedSetIds.has(s.id))
			.map(s => ({
				id: s.id,
				items: s.items.map(it => ({ref: it.ref, channel: it.channel})),
				fromPool: true,
			})),
	];
	for (const set of pending) {
		if (input.consumedSetIds.has(set.id)) continue;
		const day = future.find(d => !dayHasReleaseSet(d));
		if (!day) continue;
		const placed: ScheduledItem[] = [];
		for (const it of set.items) {
			// Pool posts must still be unused and un-consumed; held posts were
			// already consumed (and validated unused) during seeding.
			if (set.fromPool) {
				if (input.consumedRefs.has(it.ref)) continue;
				if (status(it.ref) !== 'unused') continue;
			}
			placed.push({
				slot: '',
				channel: it.channel,
				type: 'release',
				ref: it.ref,
				release_set: set.id,
			});
			input.consumedRefs.add(it.ref);
		}
		days[day].unshift(...placed);
		input.consumedSetIds.add(set.id);
	}

	// 3. R2: guarantee one backlog article + its unused siblings this week,
	//    preferring a day with no release set.
	if (!weekHasBacklog) {
		const pick = input.pools.backlogArticles.find(
			a =>
				!input.consumedRefs.has(a.anchorRef) &&
				status(a.anchorRef) === 'unused',
		);
		if (pick) {
			const day =
				future.find(d => !dayHasReleaseSet(d)) ?? future[future.length - 1];
			if (day) {
				const place = (ref: string, channel: string) => {
					if (input.consumedRefs.has(ref)) return;
					if (status(ref) !== 'unused') return;
					days[day].push({slot: '', channel, type: 'backlog-article', ref});
					input.consumedRefs.add(ref);
				};
				place(pick.anchorRef, 'github-discussion');
				for (const sib of pick.siblings) place(sib.ref, sib.channel);
				weekHasBacklog = true;
			}
		}
	}

	// 4. R1: fill each future day up to xPerDay X posts from the evergreen pool,
	//    avoiding repeating a source on the same day where possible.
	const queue = interleaveBySource(
		input.pools.evergreenX.filter(
			e => !input.consumedRefs.has(e.ref) && status(e.ref) === 'unused',
		),
	);
	for (const date of future) {
		const daySources = new Set(
			days[date].filter(i => i.source).map(i => i.source as string),
		);
		let count = days[date].filter(i => i.channel === 'x').length;
		while (count < xPerDay && queue.length > 0) {
			// Prefer an item whose source isn't already on this day.
			let idx = queue.findIndex(e => !daySources.has(e.source));
			if (idx < 0) idx = 0;
			const [item] = queue.splice(idx, 1);
			days[date].push({
				slot: '',
				channel: 'x',
				type: 'evergreen-x',
				ref: item.ref,
				source: item.source,
			});
			input.consumedRefs.add(item.ref);
			daySources.add(item.source);
			count++;
		}
	}

	// 5. Assign human-readable slot labels: one running counter per channel per
	//    day (x-1..x-6, github-discussion-1, ...). Purely cosmetic / for the UI.
	for (const date of dates) {
		const counters = new Map<string, number>();
		for (const item of days[date]) {
			const n = (counters.get(item.channel) ?? 0) + 1;
			counters.set(item.channel, n);
			item.slot = `${item.channel}-${n}`;
		}
	}

	return {week_of: input.weekOf, generated_at: input.generatedAt, days};
}

/** Count X items on a day — used by the planner's run summary. */
export function xCount(items: ScheduledItem[]): number {
	return items.filter(i => i.channel === 'x').length;
}

// ── UI resolution (ledger ref → live content) ────────────────────────────────

/** One scheduled item with its live content + status resolved for the page. */
export type ResolvedItem = {
	slot: string;
	channel: string;
	type: SlotType;
	ref: string;
	releaseSet: string | null;
	source: string | null;
	title: string | null;
	body: string;
	raw: string;
	distributedAt: string | null;
	wontUseAt: string | null;
	/** Human label for the item's origin, e.g. "nanocoder v1.28.0". */
	sourceLabel: string;
	/** Deep link to the item on its own pack page, or null if unresolvable. */
	packPath: string | null;
	/** The ref pointed at a file that no longer exists on disk. */
	missing: boolean;
	/** For article posts: a stable key grouping an article's channels together. */
	articleKey: string | null;
	/** For article posts: the article's title (for grouping + labelling). */
	articleTitle: string | null;
	/** First line of the body, for a compact row label. */
	preview: string;
};

export type ResolvedDay = {date: string; items: ResolvedItem[]};

export type ResolvedWeek = {
	weekOf: string;
	generatedAt: string;
	days: ResolvedDay[];
};

export type CalendarWeekSummary = {
	weekOf: string;
	generatedAt: string;
	itemCount: number;
};

/**
 * Turn a ref (a repoPath under content/) into a human source label plus the
 * in-app deep link that opens that exact file on its own pack page. The `?file`
 * value must match the channel key the pack readers assign (see lib/content):
 * top-level channels use their stem, article files use `article:<slug>:<ch>`.
 */
function describeRef(ref: string): {
	sourceLabel: string;
	packPath: string | null;
} {
	const rel = ref.replace(/^content\//, '');
	const parts = rel.split('/');
	const stem = (p: string) => p.replace(/\.md$/, '');
	const link = (path: string, file: string) =>
		`${path}?file=${encodeURIComponent(file)}`;

	if (parts[0] === COLLECTIVE_DIR && parts[1]) {
		const slug = parts[1];
		const ch = stem(parts[parts.length - 1]);
		return {
			sourceLabel: `collective: ${slug}`,
			packPath: link(`/c/${slug}`, ch),
		};
	}
	if (parts[0] === X_DAILY_DIR && parts[1]) {
		const date = parts[1];
		const ch = stem(parts[parts.length - 1]);
		return {sourceLabel: `X daily · ${date}`, packPath: link(`/x/${date}`, ch)};
	}
	const [product, version] = parts;
	if (product && version) {
		const label = `${product} v${version}`;
		const base = `/p/${product}/${version}`;
		if (parts[2] === 'articles' && parts[3]) {
			const ch = stem(parts[parts.length - 1]);
			return {
				sourceLabel: label,
				packPath: link(base, `article:${parts[3]}:${ch}`),
			};
		}
		const ch = stem(parts[parts.length - 1]);
		return {sourceLabel: label, packPath: link(base, ch)};
	}
	return {sourceLabel: ref, packPath: null};
}

/** Parse an article ref into its product/version/slug, or null if not one. */
function parseArticle(
	ref: string,
): {product: string; version: string; slug: string} | null {
	const parts = ref.replace(/^content\//, '').split('/');
	if (parts[2] === 'articles' && parts[1] && parts[3]) {
		return {product: parts[0], version: parts[1], slug: parts[3]};
	}
	return null;
}

/** The article's title from its meta.json, or a prettified slug fallback. */
function articleTitleOf(a: {
	product: string;
	version: string;
	slug: string;
}): string {
	try {
		const meta = JSON.parse(
			readFileSync(
				join(
					process.cwd(),
					'content',
					a.product,
					a.version,
					'articles',
					a.slug,
					'meta.json',
				),
				'utf8',
			),
		) as {title?: unknown};
		if (typeof meta.title === 'string' && meta.title.length > 0) {
			return meta.title;
		}
	} catch {
		// fall through to the slug
	}
	return a.slug.replace(/-/g, ' ');
}

/** First non-empty line of the body, collapsed and capped for a row label. */
function previewOf(body: string): string {
	const line = body
		.split('\n')
		.map(l => l.trim())
		.find(l => l.length > 0);
	if (!line) return '';
	return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

function resolveItem(item: ScheduledItem): ResolvedItem {
	const abs = join(process.cwd(), item.ref);
	let title: string | null = null;
	let body = '';
	let raw = '';
	let distributedAt: string | null = null;
	let wontUseAt: string | null = null;
	let missing = false;
	try {
		raw = readFileSync(abs, 'utf8');
		const parsed = matter(raw);
		const fm = parsed.data as Record<string, unknown>;
		body = parsed.content;
		if (typeof fm.title === 'string') title = fm.title;
		if (typeof fm.distributed_at === 'string')
			distributedAt = fm.distributed_at;
		if (typeof fm.wont_use_at === 'string') wontUseAt = fm.wont_use_at;
	} catch {
		missing = true;
	}
	const {sourceLabel, packPath} = describeRef(item.ref);
	const article = parseArticle(item.ref);
	return {
		slot: item.slot,
		channel: item.channel,
		type: item.type,
		ref: item.ref,
		releaseSet: item.release_set ?? null,
		source: item.source ?? null,
		title,
		body,
		raw,
		distributedAt,
		wontUseAt,
		sourceLabel,
		packPath,
		missing,
		articleKey: article
			? `${article.product}/${article.version}/${article.slug}`
			: null,
		articleTitle: article ? articleTitleOf(article) : null,
		preview: previewOf(body),
	};
}

/** Read one week's ledger and resolve every ref to its live content + status. */
export function readCalendarWeek(
	weekOf: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): ResolvedWeek | null {
	const week = readSchedule(weekOf, contentDir);
	if (!week) return null;
	return {
		weekOf,
		generatedAt: week.generated_at,
		days: weekDates(weekOf).map(date => ({
			date,
			items: (week.days[date] ?? []).map(resolveItem),
		})),
	};
}

/** Every calendar week present, newest first, with a total item count. */
export function listCalendarWeeks(
	contentDir: string = DEFAULT_CONTENT_DIR,
): CalendarWeekSummary[] {
	return listSchedules(contentDir).map(w => ({
		weekOf: w.week_of,
		generatedAt: w.generated_at,
		itemCount: Object.values(w.days).reduce((n, items) => n + items.length, 0),
	}));
}

// ── Month view ───────────────────────────────────────────────────────────────

/** One day cell in the month grid. `inMonth` is false for the leading/trailing
 *  spill days that pad the grid out to whole Monday-Sunday weeks. */
export type MonthCell = {date: string; inMonth: boolean; items: ResolvedItem[]};

export type ResolvedMonth = {
	key: string; // "YYYY-MM"
	label: string; // "July 2026"
	weeks: MonthCell[][]; // rows of 7 cells, Monday-first
};

/** Index every scheduled item across all week ledgers by its date. */
function scheduledByDate(contentDir: string): Map<string, ScheduledItem[]> {
	const byDate = new Map<string, ScheduledItem[]>();
	for (const week of listSchedules(contentDir)) {
		for (const [date, items] of Object.entries(week.days)) {
			const list = byDate.get(date) ?? [];
			list.push(...items);
			byDate.set(date, list);
		}
	}
	return byDate;
}

/**
 * Build a month's calendar grid — full Monday-Sunday weeks covering every day
 * of the month — with each day's scheduled items resolved to live content.
 */
export function readCalendarMonth(
	key: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): ResolvedMonth {
	const firstOfMonth = `${key}-01`;
	const firstDate = new Date(`${firstOfMonth}T00:00:00Z`);
	const lastDate = new Date(
		Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 0),
	);
	const gridStartMonday = mondayOf(firstOfMonth);
	const lastMonday = mondayOf(lastDate.toISOString().slice(0, 10));

	const byDate = scheduledByDate(contentDir);
	const weeks: MonthCell[][] = [];
	for (let wk = gridStartMonday; ; wk = addWeeks(wk, 1)) {
		weeks.push(
			weekDates(wk).map(date => ({
				date,
				inMonth: date.slice(0, 7) === key,
				items: (byDate.get(date) ?? []).map(resolveItem),
			})),
		);
		if (wk === lastMonday) break;
	}

	return {key, label: monthLabel(key), weeks};
}

/** Every "YYYY-MM" that has at least one scheduled item, newest first. */
export function listCalendarMonths(
	contentDir: string = DEFAULT_CONTENT_DIR,
): {key: string; label: string}[] {
	const keys = new Set<string>();
	for (const week of listSchedules(contentDir)) {
		for (const [date, items] of Object.entries(week.days)) {
			if (items.length > 0) keys.add(date.slice(0, 7));
		}
	}
	return [...keys]
		.sort()
		.reverse()
		.map(k => ({key: k, label: monthLabel(k)}));
}
